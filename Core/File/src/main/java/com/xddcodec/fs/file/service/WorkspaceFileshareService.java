/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

/**
 * 为工作空间初始化协作页 fileshare 根目录。
 */
public interface WorkspaceFileshareService {

    void ensureFileshareFolder(String workspaceId, String ownerUserId);

    void ensureRagFolder(String workspaceId, String ownerUserId);

    String ensureMemosFolder(String workspaceId, String ownerUserId);

    String ensureScaleFolder(String workspaceId, String ownerUserId);
}
