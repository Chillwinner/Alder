/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceCmd;
import com.xddcodec.fs.System.domain.dto.UpdateWorkspaceCmd;
import com.xddcodec.fs.System.domain.vo.WorkspaceDetailVO;
import com.xddcodec.fs.System.domain.vo.WorkspaceVO;

import java.io.Serializable;
import java.util.List;

/**
 * 工作空间表 服务层
 *
 * @author xddcode
 * @date 2026/3/30 10:11
 */
public interface SysWorkspaceService {

    SysWorkspace getById(Serializable id);

    void updateById(SysWorkspace workspace);

    /**
     * 查询工作空间列表
     *
     * @param userId 用户ID
     * @return 工作空间列表
     */
    List<WorkspaceVO> getWorkspacesByUser(String userId);

    /**
     * 创建工作空间
     *
     * @param cmd 创建工作空间命令
     * @return 工作空间VO
     */
    WorkspaceVO createWorkspace(CreateWorkspaceCmd cmd);

    /**
     * 获取当前工作空间详情
     *
     * @param workspaceId 工作空间ID
     * @param userId 用户ID
     * @return 工作空间详情
     */
    WorkspaceDetailVO getCurrentDetail(String workspaceId, String userId);

    /**
     * 更新工作空间
     *
     * @param workspaceId 工作空间ID
     * @param cmd 更新命令
     * @return 工作空间VO
     */
    WorkspaceVO updateWorkspace(String workspaceId, UpdateWorkspaceCmd cmd);

    /**
     * 删除工作空间
     *
     * @param workspaceId 工作空间ID
     * @param userId 用户ID
     */
    void deleteWorkspace(String workspaceId, String userId);

    /**
     * 检查 slug 是否可用
     *
     * @param slug slug
     * @return 是否可用
     */
    boolean checkSlug(String slug);
}
