/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.System.domain.SysWorkspace;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class WorkspaceRagAccess {

    private static final Set<String> RESERVED_ROOT_NAMES = Set.of("fileshare", "rag");

    private final SysWorkspaceMapper workspaceMapper;
    private final FileInfoMapper fileInfoMapper;
    private final StorageMountService storageMountService;

    public Set<String> protectedRootIds() {
        Set<String> ids = new HashSet<>();
        ids.add(StorageMountService.LOCAL);
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(workspaceId)) {
            return ids;
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            return ids;
        }
        if (StringUtils.isNotBlank(workspace.getFileshareFolderId())) {
            ids.add(workspace.getFileshareFolderId());
        }
        if (StringUtils.isNotBlank(workspace.getRagFolderId())) {
            ids.add(workspace.getRagFolderId());
        }
        return ids;
    }

    public boolean isProtectedRoot(String fileId) {
        if (StringUtils.isBlank(fileId)) {
            return false;
        }
        if (storageMountService.isMountRoot(fileId)) {
            return true;
        }
        if (protectedRootIds().contains(fileId)) {
            return true;
        }
        FileInfo row = fileInfoMapper.selectById(fileId);
        return isReservedRoot(row) || isMemosFolder(row) || isScaleFolder(row);
    }

    private boolean isReservedRoot(FileInfo row) {
        return row != null
                && Boolean.TRUE.equals(row.getIsDir())
                && StringUtils.isBlank(row.getParentId())
                && row.getDisplayName() != null
                && RESERVED_ROOT_NAMES.contains(row.getDisplayName().toLowerCase());
    }

    private boolean isMemosFolder(FileInfo row) {
        if (row == null || !Boolean.TRUE.equals(row.getIsDir()) || row.getDisplayName() == null) {
            return false;
        }
        if (!"memos".equalsIgnoreCase(row.getDisplayName())) {
            return false;
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(workspaceId) || StringUtils.isBlank(row.getParentId())) {
            return false;
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        return workspace != null && row.getParentId().equals(workspace.getFileshareFolderId());
    }

    private boolean isScaleFolder(FileInfo row) {
        if (row == null || !Boolean.TRUE.equals(row.getIsDir()) || row.getDisplayName() == null) {
            return false;
        }
        if (!"scale".equalsIgnoreCase(row.getDisplayName())) {
            return false;
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(workspaceId) || StringUtils.isBlank(row.getParentId())) {
            return false;
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        return workspace != null && row.getParentId().equals(workspace.getFileshareFolderId());
    }

    public void assertNotProtectedRoots(Collection<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }
        for (String fileId : fileIds) {
            if (isProtectedRoot(fileId)) {
                throw new BusinessException(ErrorMessages.FILE_SYSTEM_FOLDER_PROTECTED);
            }
        }
    }

    public void markSystemProtected(List<FileVO> files) {
        if (files == null || files.isEmpty()) {
            return;
        }
        for (FileVO file : files) {
            if (file != null && (isProtectedRoot(file.getId())
                    || isReservedRoot(fileInfoMapper.selectById(file.getId()))
                    || isMemosFolder(fileInfoMapper.selectById(file.getId()))
                    || isScaleFolder(fileInfoMapper.selectById(file.getId())))) {
                file.setSystemProtected(true);
            }
        }
    }

    public void assertAdminWriteOnParent(String parentId) {
        if (!touchesRagTree(parentId)) {
            return;
        }
        requireAdmin();
    }

    public void assertAdminWriteOnFile(String fileId) {
        if (StringUtils.isBlank(fileId) || !touchesRagTree(fileId)) {
            return;
        }
        requireAdmin();
    }

    public boolean isUnderRagFolder(String fileId) {
        return touchesRagTree(fileId);
    }

    public String ragFolderId() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(workspaceId)) {
            return null;
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        return workspace == null ? null : workspace.getRagFolderId();
    }

    private static void requireAdmin() {
        if (!StpUtil.isLogin() || !StpUtil.hasPermission("member:manage")) {
            throw new BusinessException(403, "只有管理员可以改 rag 暂存目录");
        }
    }

    private boolean touchesRagTree(String fileId) {
        String ragId = ragFolderId();
        if (StringUtils.isBlank(ragId) || StringUtils.isBlank(fileId)) {
            return false;
        }
        String cursor = fileId;
        for (int i = 0; i < 64 && StringUtils.isNotBlank(cursor); i++) {
            if (ragId.equals(cursor)) {
                return true;
            }
            FileInfo row = fileInfoMapper.selectById(cursor);
            if (row == null) {
                return false;
            }
            cursor = row.getParentId();
        }
        return false;
    }
}