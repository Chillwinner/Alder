/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiRagFileVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import com.xddcodec.fs.file.service.WorkspaceRagAccess;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import static dev.langchain4j.store.embedding.filter.MetadataFilterBuilder.metadataKey;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceRagService {

    private final JdbcTemplate jdbcTemplate;
    private final FileInfoMapper fileInfoMapper;
    private final FileInfoService fileInfoService;
    private final WorkspaceRagAccess ragAccess;
    private final WorkspaceFileshareService fileshareService;
    private final SysWorkspaceMapper workspaceMapper;
    private final QwenEmbeddingClient embeddingClient;
    private final PgVectorEmbeddingStore embeddingStore;

    @Transactional(rollbackFor = Exception.class)
    public List<WorkspaceAiRagFileVO> uploadStaging(MultipartFile file) {
        String workspaceId = requireWorkspace();
        ensureFolder(workspaceId);
        String ragId = ragAccess.ragFolderId();
        if (StringUtils.isBlank(ragId)) {
            throw new BusinessException(400, "无法创建 rag 暂存目录");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "请选择文件");
        }
        if (WorkspaceRagText.skipMedia(file.getOriginalFilename(), file.getContentType())) {
            throw new BusinessException(400, "不支持图片、音频或视频，请上传文本或文档");
        }
        if (file.getSize() > WorkspaceRagText.MAX_BYTES) {
            throw new BusinessException(400, "超过 20MB");
        }
        ragAccess.assertAdminWriteOnParent(ragId);
        try (InputStream in = file.getInputStream()) {
            fileInfoService.importStream(
                    in,
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getSize(),
                    ragId);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(400, "上传失败: " + e.getMessage());
        }
        return listStaging();
    }

    public List<WorkspaceAiRagFileVO> listStaging() {
        String workspaceId = requireWorkspace();
        ensureFolder(workspaceId);
        String ragId = ragAccess.ragFolderId();
        if (StringUtils.isBlank(ragId)) {
            return List.of();
        }
        Map<String, Integer> indexed = indexedChunkCounts(workspaceId);
        List<WorkspaceAiRagFileVO> out = new ArrayList<>();
        for (FileInfo file : walkFiles(ragId, workspaceId)) {
            WorkspaceAiRagFileVO vo = new WorkspaceAiRagFileVO();
            vo.setFileId(file.getId());
            vo.setDisplayName(file.getDisplayName());
            vo.setSize(file.getSize());
            vo.setIndexed(indexed.containsKey(file.getId()));
            vo.setChunkCount(indexed.getOrDefault(file.getId(), 0));
            out.add(vo);
        }
        return out;
    }

    public List<WorkspaceAiRagFileVO> listIndexed() {
        String workspaceId = requireWorkspace();
        return jdbcTemplate.query(
                """
                        SELECT file_id, display_name, chunk_count
                        FROM workspace_ai_rag_doc
                        WHERE workspace_id = ?
                        ORDER BY indexed_at DESC
                        """,
                (rs, i) -> {
                    WorkspaceAiRagFileVO vo = new WorkspaceAiRagFileVO();
                    vo.setFileId(rs.getString("file_id"));
                    vo.setDisplayName(rs.getString("display_name"));
                    vo.setIndexed(true);
                    vo.setChunkCount(rs.getInt("chunk_count"));
                    return vo;
                },
                workspaceId);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<WorkspaceAiRagFileVO> index(List<String> fileIds) {
        String workspaceId = requireWorkspace();
        ensureFolder(workspaceId);
        if (fileIds == null || fileIds.isEmpty()) {
            throw new BusinessException(400, "请选择要入库的文件");
        }
        for (String fileId : new LinkedHashSet<>(fileIds)) {
            indexOne(workspaceId, fileId);
        }
        return listIndexed();
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(String fileId) {
        String workspaceId = requireWorkspace();
        if (StringUtils.isBlank(fileId)) {
            throw new BusinessException(400, "fileId 不能为空");
        }
        String docId = jdbcTemplate.query(
                "SELECT id FROM workspace_ai_rag_doc WHERE workspace_id = ? AND file_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                workspaceId, fileId);
        if (docId == null) {
            return;
        }
        embeddingStore.removeAll(
                metadataKey("workspaceId").isEqualTo(workspaceId)
                        .and(metadataKey("fileId").isEqualTo(fileId)));
        jdbcTemplate.update("DELETE FROM workspace_ai_rag_doc WHERE id = ?", docId);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<WorkspaceAiRagFileVO> reindex(String fileId) {
        remove(fileId);
        return index(List.of(fileId));
    }

    public String search(String query, Integer topK) {
        String workspaceId = requireWorkspace();
        if (StringUtils.isBlank(query)) {
            return "请提供检索问题。";
        }
        int k = topK == null ? 8 : Math.min(20, Math.max(1, topK));
        List<float[]> vectors = embeddingClient.embed(List.of(query.trim()));
        if (vectors.isEmpty()) {
            return "embedding 失败。";
        }
        EmbeddingSearchResult<TextSegment> result = embeddingStore.search(
                EmbeddingSearchRequest.builder()
                        .queryEmbedding(Embedding.from(vectors.get(0)))
                        .maxResults(k)
                        .minScore(0d)
                        .filter(metadataKey("workspaceId").isEqualTo(workspaceId))
                        .build());
        if (result.matches().isEmpty()) {
            return "知识库暂无命中。可在空间设置里把 rag 暂存目录中的文件入库。";
        }
        StringBuilder sb = new StringBuilder();
        int n = 1;
        for (EmbeddingMatch<TextSegment> match : result.matches()) {
            TextSegment segment = match.embedded();
            String fileId = segment == null || segment.metadata() == null
                    ? ""
                    : String.valueOf(segment.metadata().getString("fileId"));
            String name = segment == null || segment.metadata() == null
                    ? ""
                    : String.valueOf(segment.metadata().getString("displayName"));
            String content = segment == null ? "" : segment.text();
            sb.append(n++).append(". «fs:").append(fileId).append("» ")
                    .append(name).append('\n')
                    .append(content).append("\n\n");
        }
        return sb.toString().trim();
    }

    private void indexOne(String workspaceId, String fileId) {
        if (!ragAccess.isUnderRagFolder(fileId)) {
            throw new BusinessException(400, "只能入库 rag 暂存目录里的文件");
        }
        FileInfo file = fileInfoMapper.selectByIdAndWorkspace(fileId, workspaceId);
        if (file == null || Boolean.TRUE.equals(file.getIsDir()) || Boolean.TRUE.equals(file.getIsDeleted())) {
            throw new BusinessException(400, "文件不存在或不是普通文件: " + fileId);
        }
        if (WorkspaceRagText.skipMedia(file.getDisplayName(), file.getMimeType())) {
            throw new BusinessException(400, "不支持向量化: " + file.getDisplayName());
        }
        long size = file.getSize() == null ? 0L : file.getSize();
        if (size > WorkspaceRagText.MAX_BYTES) {
            throw new BusinessException(400, "超过 20MB: " + file.getDisplayName());
        }
        String text;
        try (InputStream in = fileInfoService.downloadFile(fileId)) {
            text = WorkspaceRagText.extract(in);
        } catch (Exception e) {
            throw new BusinessException(400, "提取失败: " + file.getDisplayName() + " " + e.getMessage());
        }
        List<String> chunks = WorkspaceRagText.chunk(text);
        if (chunks.isEmpty()) {
            throw new BusinessException(400, "没有可索引文本: " + file.getDisplayName());
        }
        remove(fileId);
        String docId = IdUtil.fastSimpleUUID();
        jdbcTemplate.update(
                """
                        INSERT INTO workspace_ai_rag_doc
                        (id, workspace_id, file_id, display_name, char_count, chunk_count, indexed_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                        """,
                docId, workspaceId, fileId, file.getDisplayName(), text.length(), chunks.size());
        List<float[]> vectors = embeddingClient.embed(chunks);
        List<String> ids = new ArrayList<>();
        List<Embedding> embeddings = new ArrayList<>();
        List<TextSegment> segments = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            ids.add(java.util.UUID.randomUUID().toString());
            embeddings.add(Embedding.from(vectors.get(i)));
            Metadata metadata = new Metadata()
                    .put("workspaceId", workspaceId)
                    .put("fileId", fileId)
                    .put("displayName", file.getDisplayName())
                    .put("chunkIndex", String.valueOf(i));
            segments.add(TextSegment.from(chunks.get(i), metadata));
        }
        embeddingStore.addAll(ids, embeddings, segments);
    }

    private List<FileInfo> walkFiles(String folderId, String workspaceId) {
        List<FileInfo> files = new ArrayList<>();
        List<FileInfo> stack = new ArrayList<>(fileInfoMapper.selectChildren(folderId, workspaceId, false));
        while (!stack.isEmpty()) {
            FileInfo node = stack.remove(stack.size() - 1);
            if (Boolean.TRUE.equals(node.getIsDir())) {
                stack.addAll(fileInfoMapper.selectChildren(node.getId(), workspaceId, false));
            } else {
                files.add(node);
            }
        }
        return files;
    }

    private Map<String, Integer> indexedChunkCounts(String workspaceId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT file_id, chunk_count FROM workspace_ai_rag_doc WHERE workspace_id = ?",
                workspaceId);
        return rows.stream().collect(Collectors.toMap(
                r -> String.valueOf(r.get("file_id")),
                r -> ((Number) r.get("chunk_count")).intValue(),
                (a, b) -> a));
    }

    private void ensureFolder(String workspaceId) {
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            return;
        }
        if (StringUtils.isBlank(workspace.getRagFolderId())) {
            String owner = StringUtils.isNotBlank(workspace.getOwnerId())
                    ? workspace.getOwnerId()
                    : UserContext.getUserId();
            fileshareService.ensureRagFolder(workspaceId, owner);
        }
    }

    private static String requireWorkspace() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(workspaceId)) {
            throw new BusinessException(400, "缺少工作空间");
        }
        return workspaceId;
    }
}