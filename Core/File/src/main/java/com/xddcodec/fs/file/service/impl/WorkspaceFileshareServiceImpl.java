/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.System.domain.SysWorkspace;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceFileshareServiceImpl implements WorkspaceFileshareService {

    public static final String FILESHARE_DIR_NAME = "fileshare";
    public static final String RAG_DIR_NAME = "rag";
    public static final String MEMOS_DIR_NAME = "memos";
    public static final String SCALE_DIR_NAME = "scale";

    private static final ConcurrentHashMap<String, Object> LOCKS = new ConcurrentHashMap<>();

    private final SysWorkspaceMapper workspaceMapper;
    private final FileInfoService fileInfoService;
    private final FileInfoMapper fileInfoMapper;

    private Object lockFor(String workspaceId) {
        return LOCKS.computeIfAbsent(workspaceId, key -> new Object());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void ensureFileshareFolder(String workspaceId, String ownerUserId) {
        synchronized (lockFor(workspaceId)) {
            SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
            if (workspace == null || reviveSystemFolder(workspace.getFileshareFolderId(), workspaceId)) {
                return;
            }
            FileInfo existing = fileInfoMapper.selectSameLevelExactName(
                    workspaceId, null, FILESHARE_DIR_NAME, true, null);
            if (existing != null) {
                workspaceMapper.updateFileshareFolderId(workspaceId, existing.getId());
                return;
            }
            FileInfo dir = createRootDir(workspaceId, ownerUserId, FILESHARE_DIR_NAME);
            workspaceMapper.updateFileshareFolderId(workspaceId, dir.getId());
            log.info("已创建工作空间 fileshare 目录: workspaceId={}, folderId={}", workspaceId, dir.getId());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void ensureRagFolder(String workspaceId, String ownerUserId) {
        synchronized (lockFor(workspaceId)) {
            SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
            if (workspace == null || reviveSystemFolder(workspace.getRagFolderId(), workspaceId)) {
                return;
            }
            FileInfo existing = fileInfoMapper.selectSameLevelExactName(
                    workspaceId, null, RAG_DIR_NAME, true, null);
            if (existing != null) {
                workspaceMapper.updateRagFolderId(workspaceId, existing.getId());
                return;
            }
            FileInfo dir = createRootDir(workspaceId, ownerUserId, RAG_DIR_NAME);
            workspaceMapper.updateRagFolderId(workspaceId, dir.getId());
            log.info("已创建工作空间 rag 暂存目录: workspaceId={}, folderId={}", workspaceId, dir.getId());
        }
    }

    private FileInfo createRootDir(String workspaceId, String ownerUserId, String name) {
        String previousWorkspace = WorkspaceContext.getWorkspaceId();
        String previousUser = UserContext.getUserId();
        String previousStorage = StorageContext.getConfigId();
        try {
            WorkspaceContext.setWorkspaceId(workspaceId);
            UserContext.setUserId(ownerUserId);
            StorageContext.setConfigId(null);
            CreateDirectoryCmd cmd = new CreateDirectoryCmd();
            cmd.setFolderName(name);
            cmd.setParentId(null);
            return fileInfoService.createDirectory(cmd);
        } finally {
            WorkspaceContext.setWorkspaceId(previousWorkspace);
            UserContext.setUserId(previousUser);
            StorageContext.setConfigId(previousStorage);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String ensureMemosFolder(String workspaceId, String ownerUserId) {
        ensureFileshareFolder(workspaceId, ownerUserId);
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null || StringUtils.isBlank(workspace.getFileshareFolderId())) {
            return null;
        }
        FileInfo existing = fileInfoMapper.selectSameLevelExactName(
                workspaceId, workspace.getFileshareFolderId(), MEMOS_DIR_NAME, true, null);
        if (existing != null) {
            if (Boolean.TRUE.equals(existing.getIsDeleted())) {
                fileInfoMapper.restoreByIds(List.of(existing.getId()), workspaceId);
            }
            return existing.getId();
        }
        String previousWorkspace = WorkspaceContext.getWorkspaceId();
        String previousUser = UserContext.getUserId();
        String previousStorage = StorageContext.getConfigId();
        try {
            WorkspaceContext.setWorkspaceId(workspaceId);
            UserContext.setUserId(ownerUserId);
            StorageContext.setConfigId(null);
            CreateDirectoryCmd cmd = new CreateDirectoryCmd();
            cmd.setFolderName(MEMOS_DIR_NAME);
            cmd.setParentId(workspace.getFileshareFolderId());
            FileInfo dir = fileInfoService.createDirectory(cmd);
            log.info("已创建工作空间 memos 目录: workspaceId={}, folderId={}", workspaceId, dir.getId());
            return dir.getId();
        } finally {
            WorkspaceContext.setWorkspaceId(previousWorkspace);
            UserContext.setUserId(previousUser);
            StorageContext.setConfigId(previousStorage);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String ensureScaleFolder(String workspaceId, String ownerUserId) {
        synchronized (lockFor(workspaceId)) {
            ensureFileshareFolder(workspaceId, ownerUserId);
            SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
            if (workspace == null || StringUtils.isBlank(workspace.getFileshareFolderId())) {
                return null;
            }
            FileInfo existing = fileInfoMapper.selectSameLevelExactName(
                    workspaceId, workspace.getFileshareFolderId(), SCALE_DIR_NAME, true, null);
            if (existing != null) {
                if (Boolean.TRUE.equals(existing.getIsDeleted())) {
                    fileInfoMapper.restoreByIds(List.of(existing.getId()), workspaceId);
                }
                return existing.getId();
            }
            String previousWorkspace = WorkspaceContext.getWorkspaceId();
            String previousUser = UserContext.getUserId();
            String previousStorage = StorageContext.getConfigId();
            try {
                WorkspaceContext.setWorkspaceId(workspaceId);
                UserContext.setUserId(ownerUserId);
                StorageContext.setConfigId(null);
                CreateDirectoryCmd cmd = new CreateDirectoryCmd();
                cmd.setFolderName(SCALE_DIR_NAME);
                cmd.setParentId(workspace.getFileshareFolderId());
                FileInfo dir = fileInfoService.createDirectory(cmd);
                log.info("已创建工作空间 scale 目录: workspaceId={}, folderId={}", workspaceId, dir.getId());
                return dir.getId();
            } finally {
                WorkspaceContext.setWorkspaceId(previousWorkspace);
                UserContext.setUserId(previousUser);
                StorageContext.setConfigId(previousStorage);
            }
        }
    }

    private boolean reviveSystemFolder(String folderId, String workspaceId) {
        if (StringUtils.isBlank(folderId)) {
            return false;
        }
        FileInfo folder = fileInfoService.getById(folderId);
        if (folder == null
                || !workspaceId.equals(folder.getWorkspaceId())
                || !Boolean.TRUE.equals(folder.getIsDir())) {
            return false;
        }
        if (Boolean.TRUE.equals(folder.getIsDeleted())) {
            fileInfoMapper.restoreByIds(List.of(folderId), workspaceId);
            log.info("已恢复工作空间系统目录: workspaceId={}, folderId={}", workspaceId, folderId);
        }
        return true;
    }
}
