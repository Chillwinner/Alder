/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.RenameFileCmd;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemoVaultService {

    private final WorkspaceFileshareService fileshareService;
    private final FileInfoService fileInfoService;
    private final FileInfoMapper fileInfoMapper;

    public String ensureMemosFolder() {
        return fileshareService.ensureMemosFolder(WorkspaceContext.getWorkspaceId(), UserContext.getUserId());
    }

    public static final String EMPTY_CANVAS = "{\"nodes\":[],\"edges\":[]}";

    public String createMemoFile(String title, String markdown) {
        return createVaultFile(title, StringUtils.defaultString(markdown), false);
    }

    public String createCanvasFile(String title) {
        return createVaultFile(title, EMPTY_CANVAS, true);
    }

    private String createVaultFile(String title, String text, boolean canvas) {
        String folderId = ensureMemosFolder();
        if (StringUtils.isBlank(folderId)) {
            return null;
        }
        byte[] bytes = StringUtils.defaultString(text).getBytes(StandardCharsets.UTF_8);
        String name = uniqueName(folderId, canvas ? canvasFileName(title) : fileName(title));
        FileInfo file = fileInfoService.importStream(
                new ByteArrayInputStream(bytes),
                name,
                canvas ? "application/json" : "text/markdown",
                (long) bytes.length,
                folderId);
        return file == null ? null : file.getId();
    }

    public String readMarkdown(WorkspaceMemo memo) {
        String fileId = memo.getFileId();
        if (StringUtils.isBlank(fileId)) {
            return null;
        }
        try (var in = fileInfoService.downloadFile(fileId)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("读取备忘录文件失败 memoId={} fileId={}", memo.getId(), fileId, e);
            return null;
        }
    }

    public String writeMarkdown(WorkspaceMemo memo, String markdown) {
        return writeVaultText(memo, markdown, false);
    }

    public String writeCanvas(WorkspaceMemo memo, String json) {
        return writeVaultText(memo, json, true);
    }

    private String writeVaultText(WorkspaceMemo memo, String text, boolean canvas) {
        String body = StringUtils.defaultString(text);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        if (StringUtils.isBlank(memo.getFileId())) {
            return createVaultFile(memo.getTitle(), body, canvas);
        }
        try {
            fileInfoService.replaceFileContent(memo.getFileId(), bytes);
            return memo.getFileId();
        } catch (Exception e) {
            log.warn("覆盖备忘录文件失败，改为新建 memoId={}", memo.getId(), e);
            return createVaultFile(memo.getTitle(), body, canvas);
        }
    }

    public void renameMarkdown(WorkspaceMemo memo, String title) {
        if (StringUtils.isBlank(memo.getFileId()) || StringUtils.isBlank(title)) {
            return;
        }
        try {
            FileInfo file = fileInfoMapper.selectById(memo.getFileId());
            boolean canvas = file != null && isCanvasName(file.getDisplayName());
            RenameFileCmd cmd = new RenameFileCmd();
            cmd.setDisplayName(canvas ? canvasFileName(title) : fileName(title));
            fileInfoService.renameFile(memo.getFileId(), cmd);
        } catch (Exception e) {
            log.warn("重命名备忘录文件失败 memoId={}", memo.getId(), e);
        }
    }

    public void recycleMarkdown(WorkspaceMemo memo) {
        if (StringUtils.isBlank(memo.getFileId())) {
            return;
        }
        try {
            FileInfo file = fileInfoMapper.selectById(memo.getFileId());
            if (file == null || Boolean.TRUE.equals(file.getIsDeleted())) {
                return;
            }
            fileInfoMapper.markDeletedByIds(List.of(file.getId()), LocalDateTime.now());
        } catch (Exception e) {
            log.warn("回收备忘录文件失败 memoId={}", memo.getId(), e);
        }
    }

    public static boolean isCanvasName(String name) {
        String n = StringUtils.defaultString(name).toLowerCase();
        return n.endsWith(".canvas") || n.endsWith(".arch.json");
    }

    public static String canvasFileName(String title) {
        String base = StringUtils.defaultIfBlank(title, "未命名架构图").trim();
        base = base.replaceAll("[\\\\/:*?\"<>|]", "_");
        String lower = base.toLowerCase();
        if (lower.endsWith(".canvas") || lower.endsWith(".arch.json")) {
            return base;
        }
        if (lower.endsWith(".json")) {
            return base.substring(0, base.length() - 5) + ".canvas";
        }
        return base + ".canvas";
    }

    public static String fileName(String title) {
        String base = StringUtils.defaultIfBlank(title, "未命名备忘录").trim();
        base = base.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (base.toLowerCase().endsWith(".md")) {
            return base;
        }
        return base + ".md";
    }

    private String uniqueName(String folderId, String desired) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String stem = desired;
        String ext = "";
        String lower = desired.toLowerCase();
        if (lower.endsWith(".arch.json")) {
            stem = desired.substring(0, desired.length() - 10);
            ext = ".arch.json";
        } else {
            int dot = desired.lastIndexOf('.');
            if (dot > 0) {
                stem = desired.substring(0, dot);
                ext = desired.substring(dot);
            }
        }
        String candidate = desired;
        for (int i = 2; i < 1000; i++) {
            FileInfo hit = fileInfoMapper.selectSameLevelExactName(
                    workspaceId, folderId, candidate, false, null);
            if (hit == null) {
                return candidate;
            }
            candidate = stem + "-" + i + ext;
        }
        return stem + "-" + System.currentTimeMillis() + ext;
    }
}
