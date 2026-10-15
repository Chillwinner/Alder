/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import cn.hutool.core.util.StrUtil;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class LocalQuotaService {

    public static final long DEFAULT_QUOTA_BYTES = 5L * 1024 * 1024 * 1024;

    private final FileInfoMapper fileInfoMapper;
    private final SysWorkspaceMapper workspaceMapper;

    public static boolean isLocalSetting(String storagePlatformSettingId) {
        return StrUtil.isBlank(storagePlatformSettingId);
    }

    public long quotaBytes(String workspaceId) {
        if (StrUtil.isBlank(workspaceId)) {
            return DEFAULT_QUOTA_BYTES;
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        Long quota = workspace == null ? null : workspace.getLocalQuotaBytes();
        return quota == null || quota <= 0 ? DEFAULT_QUOTA_BYTES : quota;
    }

    public long usedBytes(String workspaceId) {
        if (StrUtil.isBlank(workspaceId)) {
            return 0L;
        }
        return fileInfoMapper.selectUsedFiles(workspaceId, null).stream()
                .map(FileInfo::getSize)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
    }

    public void ensureRoom(String workspaceId, String storagePlatformSettingId, Long addBytes) {
        if (!isLocalSetting(storagePlatformSettingId)) {
            return;
        }
        long extra = addBytes == null || addBytes < 0 ? 0 : addBytes;
        if (extra == 0) {
            return;
        }
        if (usedBytes(workspaceId) + extra > quotaBytes(workspaceId)) {
            throw new BusinessException(ErrorMessages.FILE_LOCAL_QUOTA_EXCEEDED);
        }
    }
}
