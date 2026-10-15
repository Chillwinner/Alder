/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.UpdateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoBodyVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoCanvasVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoListPreviewVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoYjsStateVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceBoardOverviewVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceMemoVO;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceBoardPinnedFileMapper;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceMemoMapper;
import com.xddcodec.fs.workspaceboard.support.MemoDataImages;
import com.xddcodec.fs.workspaceboard.support.MemoPreviewText;
import com.xddcodec.fs.workspaceboard.support.YjsPlainText;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkspaceMemoService {

    private final WorkspaceMemoMapper memoMapper;
    private final WorkspaceBoardPinnedFileMapper pinnedFileMapper;
    private final FileInfoMapper fileInfoMapper;
    private final SysWorkspaceMapper workspaceMapper;
    private final WorkspaceFileshareService fileshareService;
    private final FileInfoService fileInfoService;
    private final MemoVaultService memoVaultService;
    private final MemoBoardMetaPushService metaPushService;
    private final MemoAccessService accessService;
    private final MemoPersistenceService persistenceService;
    private final Converter converter;

    public String readPlainText(String memoId) {
        return readExtract(memoId).text;
    }

    public YjsPlainText.Extract readExtract(String memoId) {
        WorkspaceMemo memo = accessService.requireMemo(memoId);
        if (StringUtils.isNotBlank(memo.getBodyMd())) {
            return YjsPlainText.ofPlain(memo.getBodyMd());
        }
        if (MemoAccessService.isPrivate(memo)) {
            return YjsPlainText.ofPlain(htmlToPlain(memo.getBodyHtml()));
        }
        byte[] state = persistenceService.loadInitialState(memoId);
        return YjsPlainText.parse(state);
    }

    public WorkspaceBoardOverviewVO overview() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        fileshareService.ensureFileshareFolder(workspaceId, UserContext.getUserId());
        fileshareService.ensureMemosFolder(workspaceId, UserContext.getUserId());

        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        WorkspaceBoardOverviewVO vo = new WorkspaceBoardOverviewVO();
        String folderId = workspace == null ? null : workspace.getFileshareFolderId();
        String memosFolderId = fileshareService.ensureMemosFolder(workspaceId, UserContext.getUserId());
        vo.setFileshareFolderId(folderId);
        vo.setMemosFolderId(memosFolderId);
        vo.setFileshareFiles(StringUtils.isBlank(folderId)
                ? List.of()
                : orderFileshareForBoard(workspaceId, hideMemosFolder(fileInfoService.listChildren(folderId))));
        vo.setMemos(listMemosFromVault(workspaceId, memosFolderId));
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkspaceMemoVO create(CreateWorkspaceMemoCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        WorkspaceMemo memo = new WorkspaceMemo();
        memo.setId(IdUtil.fastSimpleUUID());
        memo.setWorkspaceId(workspaceId);
        memo.setTitle(StringUtils.defaultIfBlank(cmd.getTitle(), "未命名备忘录"));
        memo.setCreatedBy(UserContext.getUserId());
        memo.setVisibility(createVisibility(cmd.getVisibility()));
        memo.setSortOrder(0);
        memo.setPinned(Boolean.FALSE);
        memo.setBodyMd("");
        boolean canvas = "canvas".equalsIgnoreCase(StringUtils.trimToEmpty(cmd.getKind()));
        if (canvas) {
            memo.setTitle(StringUtils.defaultIfBlank(cmd.getTitle(), "未命名架构图"));
            memo.setFileId(memoVaultService.createCanvasFile(memo.getTitle()));
        } else {
            memo.setFileId(memoVaultService.createMemoFile(memo.getTitle(), ""));
        }
        memoMapper.insert(memo);
        WorkspaceMemo saved = accessService.requireMemo(memo.getId());
        if (!MemoAccessService.isPrivate(saved)) {
            metaPushService.publishAfterCommit(workspaceId, "created", saved);
        }
        return withKind(converter.convert(saved, WorkspaceMemoVO.class), canvas ? "canvas" : "md");
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkspaceMemoVO update(String memoId, UpdateWorkspaceMemoCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        WorkspaceMemo existing = accessService.requireMemo(memoId);
        boolean wasPrivate = MemoAccessService.isPrivate(existing);
        boolean becameShared = false;
        WorkspaceMemo patch = new WorkspaceMemo();
        patch.setId(memoId);
        patch.setWorkspaceId(workspaceId);
        patch.setTitle(cmd.getTitle());
        patch.setPinned(cmd.getPinned());
        patch.setSortOrder(cmd.getSortOrder());
        if (StringUtils.isNotBlank(cmd.getVisibility())) {
            String next = strictVisibility(cmd.getVisibility());
            if (next == null) {
                throw new BusinessException("board.memo.visibility.invalid");
            }
            if (wasPrivate && "shared".equals(next)) {
                patch.setVisibility("shared");
                becameShared = true;
            } else if (!wasPrivate && "private".equals(next)) {
                throw new BusinessException("board.memo.visibility.locked");
            }
        }
        if (cmd.getBodyHtml() != null || cmd.getBodyMd() != null) {
            writeSubmittedMarkdown(existing, patch, cmd.getBodyHtml(), cmd.getBodyMd());
        }
        memoMapper.updateMeta(patch);
        if (StringUtils.isNotBlank(cmd.getTitle()) && !cmd.getTitle().equals(existing.getTitle())) {
            memoVaultService.renameMarkdown(existing, cmd.getTitle());
        }
        WorkspaceMemo fresh = accessService.requireMemo(memoId);
        if (!MemoAccessService.isPrivate(fresh)) {
            metaPushService.publishAfterCommit(workspaceId, becameShared ? "created" : "updated", fresh);
        }
        return withKindFromFile(converter.convert(fresh, WorkspaceMemoVO.class), fresh.getFileId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(String memoId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        WorkspaceMemo existing = accessService.requireMemo(memoId);
        memoMapper.softDelete(memoId, workspaceId);
        String fileId = existing.getFileId();
        if (StringUtils.isNotBlank(fileId) && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        fileInfoService.moveFilesToRecycleBin(List.of(fileId));
                    } catch (Exception ignored) {
                        /* 备忘录已删，md 进回收站失败不回滚 */
                    }
                }
            });
        } else if (StringUtils.isNotBlank(fileId)) {
            try {
                fileInfoService.moveFilesToRecycleBin(List.of(fileId));
            } catch (Exception ignored) {
                /* 备忘录已删 */
            }
        }
        if (!MemoAccessService.isPrivate(existing)) {
            metaPushService.publishDeletedAfterCommit(workspaceId, memoId);
        }
    }

    /** 文件从回收站还原时，把对应备忘录的 deleted_at 清掉。没有备忘录就当普通文件。 */
    public void restoreByFileIds(List<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        for (String fileId : fileIds) {
            if (StringUtils.isBlank(fileId)) {
                continue;
            }
            WorkspaceMemo memo = memoMapper.selectDeletedByFileId(fileId, workspaceId);
            if (memo == null || !canSee(memo)) {
                continue;
            }
            memoMapper.restore(memo.getId(), workspaceId);
            if (!MemoAccessService.isPrivate(memo)) {
                metaPushService.publishAfterCommit(workspaceId, "created", memo);
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void setFilesharePinned(String fileId, boolean pinned) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null || StringUtils.isBlank(workspace.getFileshareFolderId())) {
            throw new BusinessException("board.fileshare.not.ready");
        }
        FileInfo file = fileInfoMapper.selectById(fileId);
        if (file == null
                || Boolean.TRUE.equals(file.getIsDeleted())
                || !workspaceId.equals(file.getWorkspaceId())
                || !workspace.getFileshareFolderId().equals(file.getParentId())) {
            throw new BusinessException("board.fileshare.file.not.found");
        }
        if (pinned) {
            pinnedFileMapper.insert(workspaceId, fileId);
        } else {
            pinnedFileMapper.delete(workspaceId, fileId);
        }
    }

    public java.util.List<com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO> listSnapshots(String memoId) {
        accessService.requireMemo(memoId);
        java.util.List<com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO> rows = new java.util.ArrayList<>();
        for (com.xddcodec.fs.workspaceboard.domain.WorkspaceMemoSnapshot snap : persistenceService.listSnapshots(memoId)) {
            com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO vo =
                    new com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO();
            vo.setId(snap.getId());
            vo.setCommitMessage(snap.getCommitMessage());
            vo.setSavedAt(snap.getSavedAt());
            rows.add(vo);
        }
        return rows;
    }

    @Transactional(rollbackFor = Exception.class)
    public com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO commitSnapshot(String memoId, String message) {
        WorkspaceMemo memo = accessService.requireMemoMeta(memoId);
        String msg = StringUtils.trimToEmpty(message);
        if (StringUtils.isBlank(msg)) {
            throw new BusinessException("board.memo.snapshot.message.required");
        }
        if (msg.length() > 200) {
            msg = msg.substring(0, 200);
        }
        com.xddcodec.fs.workspaceboard.domain.WorkspaceMemoSnapshot row =
                persistenceService.recordMarkdownRevision(memoId, readStoredMarkdown(memo), msg);
        if (row == null) {
            throw new BusinessException("board.memo.snapshot.unchanged");
        }
        com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO vo =
                new com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO();
        vo.setId(row.getId());
        vo.setCommitMessage(msg);
        vo.setSavedAt(row.getSavedAt() == null ? java.time.LocalDateTime.now() : row.getSavedAt());
        return vo;
    }

    public MemoYjsStateVO restoreSnapshot(String memoId, Long snapshotId) {
        accessService.requireMemoMeta(memoId);
        com.xddcodec.fs.workspaceboard.domain.WorkspaceMemoSnapshot row =
                persistenceService.restoreSnapshot(memoId, snapshotId);
        if (MemoPersistenceService.isMarkdownRevision(row.getYjsState())) {
            String md = MemoPersistenceService.decodeMarkdownRevision(row.getYjsState());
            saveBody(memoId, null, md);
            return new MemoYjsStateVO();
        }
        return loadYjsState(memoId);
    }

    public MemoYjsStateVO loadYjsState(String memoId) {
        accessService.requireMemoForCollab(memoId, UserContext.getUserId());
        byte[] state = persistenceService.loadInitialState(memoId);
        MemoYjsStateVO vo = new MemoYjsStateVO();
        if (state != null && state.length > 0) {
            vo.setPayloadBase64(java.util.Base64.getEncoder().encodeToString(state));
        }
        return vo;
    }

    public void assertAvailable(String memoId) {
        accessService.requireMemo(memoId);
    }

    public WorkspaceMemoVO lookupByTitle(String title) {
        String name = StringUtils.trimToEmpty(title);
        if (name.toLowerCase().endsWith(".md")) {
            name = name.substring(0, name.length() - 3);
        } else if (name.toLowerCase().endsWith(".arch.json")) {
            name = name.substring(0, name.length() - 10);
        } else if (name.toLowerCase().endsWith(".canvas")) {
            name = name.substring(0, name.length() - 7);
        }
        if (StringUtils.isBlank(name)) {
            throw new BusinessException("board.memo.not.found");
        }
        WorkspaceMemo memo = memoMapper.selectByTitle(
                WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), name);
        if (memo == null || !canSee(memo)) {
            throw new BusinessException("board.memo.not.found");
        }
        return withKindFromFile(converter.convert(memo, WorkspaceMemoVO.class), memo.getFileId());
    }

    public WorkspaceMemoVO lookupByFileId(String fileId) {
        if (StringUtils.isBlank(fileId)) {
            throw new BusinessException("board.memo.not.found");
        }
        WorkspaceMemo memo = memoMapper.selectByFileId(fileId, WorkspaceContext.getWorkspaceId());
        if (memo == null || !canSee(memo)) {
            throw new BusinessException("board.memo.not.found");
        }
        return withKindFromFile(converter.convert(memo, WorkspaceMemoVO.class), memo.getFileId());
    }

    public MemoListPreviewVO loadListPreview(String memoId) {
        String text = memoMapper.selectListSnippet(
                memoId, WorkspaceContext.getWorkspaceId(), UserContext.getUserId());
        if (text == null) {
            accessService.requireMemo(memoId);
            text = "";
        }
        MemoListPreviewVO vo = new MemoListPreviewVO();
        vo.setText(StringUtils.defaultString(text).trim());
        return vo;
    }

    public MemoBodyVO loadBody(String memoId) {
        WorkspaceMemo memo = accessService.requireMemoMeta(memoId);
        MemoBodyVO vo = new MemoBodyVO();
        vo.setMemoId(memoId);
        vo.setVisibility(normalizeVisibility(memo.getVisibility()));
        vo.setBodyMd(readStoredMarkdown(memo));
        vo.setBodyHtml(StringUtils.defaultString(memo.getBodyHtml()));
        return vo;
    }

    /** 预览专用：正文里的 data URL 换成占位，图走 inline-image，不改磁盘上的 md。 */
    public MemoBodyVO loadPreviewBody(String memoId) {
        WorkspaceMemo memo = accessService.requireMemoMeta(memoId);
        MemoBodyVO vo = new MemoBodyVO();
        vo.setMemoId(memoId);
        vo.setVisibility(normalizeVisibility(memo.getVisibility()));
        vo.setBodyMd(MemoDataImages.lite(readStoredMarkdown(memo)));
        vo.setBodyHtml("");
        return vo;
    }

    public MemoDataImages.Image inlineImage(String memoId, int index) {
        WorkspaceMemo memo = accessService.requireMemoMeta(memoId);
        MemoDataImages.Image image = MemoDataImages.imageAt(readStoredMarkdown(memo), index);
        if (image == null) {
            throw new BusinessException("board.memo.not.found");
        }
        return image;
    }

    @Transactional(rollbackFor = Exception.class)
    public MemoBodyVO saveBody(String memoId, String bodyHtml, String bodyMd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        WorkspaceMemo existing = accessService.requireMemoMeta(memoId);
        WorkspaceMemo patch = new WorkspaceMemo();
        patch.setId(memoId);
        patch.setWorkspaceId(workspaceId);
        String md = writeSubmittedMarkdown(existing, patch, bodyHtml, bodyMd);
        memoMapper.updateMeta(patch);
        if (!MemoAccessService.isPrivate(existing)) {
            metaPushService.publishAfterCommit(workspaceId, "updated", accessService.requireMemo(memoId));
        }
        MemoBodyVO vo = new MemoBodyVO();
        vo.setMemoId(memoId);
        vo.setVisibility(normalizeVisibility(existing.getVisibility()));
        vo.setBodyMd(md != null ? MemoDataImages.lite(md) : "");
        vo.setBodyHtml(StringUtils.defaultString(bodyHtml != null ? bodyHtml : existing.getBodyHtml()));
        return vo;
    }

    private String readStoredMarkdown(WorkspaceMemo memo) {
        String fromFile = memoVaultService.readMarkdown(memo);
        if (fromFile != null) {
            return fromFile;
        }
        if (StringUtils.isNotBlank(memo.getBodyMd())) {
            return memo.getBodyMd();
        }
        return "";
    }

    private List<WorkspaceMemoVO> listMemosFromVault(String workspaceId, String memosFolderId) {
        if (StringUtils.isBlank(memosFolderId)) {
            return List.of();
        }
        List<WorkspaceMemoVO> out = new ArrayList<>();
        for (FileVO file : fileInfoService.listChildren(memosFolderId)) {
            if (file == null || Boolean.TRUE.equals(file.getIsDir())) {
                continue;
            }
            String name = StringUtils.defaultString(file.getDisplayName());
            boolean canvas = MemoVaultService.isCanvasName(name);
            if (!canvas && !name.toLowerCase().endsWith(".md")) {
                continue;
            }
            String title = titleFromVaultName(name);
            WorkspaceMemo row = memoMapper.selectByFileId(file.getId(), workspaceId);
            if (row == null) {
                row = adoptVaultFile(workspaceId, file, title);
            }
            if (row == null || !canSee(row)) {
                continue;
            }
            WorkspaceMemoVO item = converter.convert(row, WorkspaceMemoVO.class);
            item.setVisibility(normalizeVisibility(row.getVisibility()));
            item.setTitle(title);
            item.setKind(canvas ? "canvas" : "md");
            item.setFileId(file.getId());
            if (file.getUpdateTime() != null) {
                item.setUpdatedAt(file.getUpdateTime());
            }
            out.add(item);
        }
        out.sort(Comparator
                .comparing((WorkspaceMemoVO m) -> !Boolean.TRUE.equals(m.getPinned()))
                .thenComparing(WorkspaceMemoVO::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    private WorkspaceMemo adoptVaultFile(String workspaceId, FileVO file, String title) {
        WorkspaceMemo memo = new WorkspaceMemo();
        memo.setId(IdUtil.fastSimpleUUID());
        memo.setWorkspaceId(workspaceId);
        memo.setTitle(title);
        memo.setCreatedBy(UserContext.getUserId());
        memo.setVisibility("private");
        memo.setSortOrder(0);
        memo.setPinned(Boolean.FALSE);
        memo.setFileId(file.getId());
        memoMapper.insert(memo);
        return memoMapper.selectById(memo.getId());
    }

    public MemoCanvasVO loadCanvas(String memoId) {
        WorkspaceMemo memo = accessService.requireMemoMeta(memoId);
        MemoCanvasVO vo = new MemoCanvasVO();
        vo.setMemoId(memoId);
        String raw = readStoredMarkdown(memo);
        vo.setDocument(StringUtils.isBlank(raw) ? MemoVaultService.EMPTY_CANVAS : raw);
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public MemoCanvasVO saveCanvas(String memoId, String document) {
        WorkspaceMemo existing = accessService.requireMemoMeta(memoId);
        String json = StringUtils.defaultIfBlank(document, MemoVaultService.EMPTY_CANVAS);
        String fileId = memoVaultService.writeCanvas(existing, json);
        WorkspaceMemo patch = new WorkspaceMemo();
        patch.setId(memoId);
        patch.setWorkspaceId(WorkspaceContext.getWorkspaceId());
        patch.setBodyMd(json);
        if (StringUtils.isNotBlank(fileId)) {
            patch.setFileId(fileId);
        }
        memoMapper.updateMeta(patch);
        WorkspaceMemo fresh = accessService.requireMemo(memoId);
        if (!MemoAccessService.isPrivate(fresh)) {
            metaPushService.publishAfterCommit(fresh.getWorkspaceId(), "updated", fresh);
        }
        MemoCanvasVO vo = new MemoCanvasVO();
        vo.setMemoId(memoId);
        vo.setDocument(json);
        return vo;
    }

    private static WorkspaceMemoVO withKind(WorkspaceMemoVO vo, String kind) {
        if (vo != null) {
            vo.setKind(kind);
        }
        return vo;
    }

    private WorkspaceMemoVO withKindFromFile(WorkspaceMemoVO vo, String fileId) {
        if (vo == null || StringUtils.isBlank(fileId)) {
            return withKind(vo, "md");
        }
        FileInfo file = fileInfoService.getById(fileId);
        boolean canvas = file != null && MemoVaultService.isCanvasName(file.getDisplayName());
        return withKind(vo, canvas ? "canvas" : "md");
    }

    private static String titleFromVaultName(String name) {
        String trimmed = StringUtils.defaultIfBlank(name, "未命名备忘录").trim();
        String lower = trimmed.toLowerCase();
        if (lower.endsWith(".arch.json")) {
            return trimmed.substring(0, trimmed.length() - 10);
        }
        if (lower.endsWith(".canvas")) {
            return trimmed.substring(0, trimmed.length() - 7);
        }
        if (lower.endsWith(".md")) {
            return trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed;
    }

    private static List<FileVO> hideMemosFolder(List<FileVO> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        return files.stream()
                .filter(f -> f == null || !"memos".equalsIgnoreCase(StringUtils.defaultString(f.getDisplayName())))
                .toList();
    }

    /** 新建：只有明确的 shared 才公开，空或非法都是 private。 */
    private static String createVisibility(String raw) {
        return "shared".equalsIgnoreCase(StringUtils.trimToEmpty(raw)) ? "shared" : "private";
    }

    /** 更新：只接受 shared / private，其它返回 null。 */
    private static String strictVisibility(String raw) {
        String value = StringUtils.trimToEmpty(raw);
        if ("shared".equalsIgnoreCase(value) || "private".equalsIgnoreCase(value)) {
            return value.toLowerCase();
        }
        return null;
    }

    /** 读出：库里的 private 才是私人，其余（含 SQL 默认 shared）按空间公开。 */
    private static String normalizeVisibility(String raw) {
        return "private".equalsIgnoreCase(StringUtils.trimToEmpty(raw)) ? "private" : "shared";
    }

    private static boolean canSee(WorkspaceMemo memo) {
        if (memo == null) {
            return false;
        }
        if (!MemoAccessService.isPrivate(memo)) {
            return true;
        }
        return StringUtils.equals(UserContext.getUserId(), memo.getCreatedBy());
    }

    /**
     * 整篇覆盖 markdown。私人与空间公开走同一条路径：body_md + vault 文件。
     * @return 本次写入的原文（占位图已还原），没有正文则 null
     */
    private String writeSubmittedMarkdown(WorkspaceMemo existing, WorkspaceMemo patch, String bodyHtml, String bodyMd) {
        String md = bodyMd != null ? bodyMd : bodyHtml;
        if (md != null && md.contains("alder-inline:")) {
            md = MemoDataImages.restoreInlinePlaceholders(md, readStoredMarkdown(existing));
        }
        if (md != null) {
            patch.setBodyMd(MemoDataImages.lite(md));
            String fileId = memoVaultService.writeMarkdown(existing, md);
            if (StringUtils.isNotBlank(fileId)) {
                patch.setFileId(fileId);
            }
        }
        if (bodyHtml != null) {
            patch.setBodyHtml(bodyHtml);
        }
        return md;
    }

    private static String htmlToPlain(String html) {
        if (StringUtils.isBlank(html)) {
            return "";
        }
        return html.replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("(?i)</p>", "\n")
                .replaceAll("(?i)</div>", "\n")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private List<FileVO> orderFileshareForBoard(String workspaceId, List<FileVO> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }
        List<String> pinnedOrder = pinnedFileMapper.selectPinnedFileIds(workspaceId);
        Set<String> pinnedSet = new HashSet<>(pinnedOrder);
        List<FileVO> mutable = new ArrayList<>(files);
        for (FileVO file : mutable) {
            file.setBoardPinned(pinnedSet.contains(file.getId()));
        }
        mutable.sort(Comparator
                .comparing((FileVO f) -> !Boolean.TRUE.equals(f.getBoardPinned()))
                .thenComparingInt(f -> {
                    int index = pinnedOrder.indexOf(f.getId());
                    return index >= 0 ? index : Integer.MAX_VALUE;
                })
                .thenComparing(FileVO::getUpdateTime, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(FileVO::getUploadTime, Comparator.nullsLast(Comparator.reverseOrder())));
        return mutable;
    }
}
