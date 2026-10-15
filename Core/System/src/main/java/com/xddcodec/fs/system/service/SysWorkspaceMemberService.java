/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceMemberCmd;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;

/**
 * 工作空间成员服务接口
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
public interface SysWorkspaceMemberService {

    /**
     * 分页查询工作空间成员
     *
     * @param workspaceId 工作空间ID
     * @param pageNumber 页码
     * @param pageSize 每页大小
     * @return 成员列表
     */
    PageResult<WorkspaceMemberVO> getMembers(String workspaceId, int pageNumber, int pageSize);

    PageResult<WorkspaceMemberVO> getMembers(String workspaceId, int pageNumber, int pageSize, String keyword);

    void updateMemberUserStatus(String workspaceId, String userId, Integer status, String currentUserId);

    /**
     * 更新成员角色
     *
     * @param workspaceId 工作空间ID
     * @param userId 用户ID
     * @param roleId 角色ID
     * @param currentUserId 当前操作用户ID
     */
    void updateMemberRole(String workspaceId, String userId, Long roleId, String currentUserId);

    /**
     * 移除成员
     *
     * @param workspaceId 工作空间ID
     * @param userId 用户ID
     * @param currentUserId 当前操作用户ID
     */
    void removeMember(String workspaceId, String userId, String currentUserId);

    /**
     * 创建工作空间成员
     *
     * @param cmd 创建成员命令
     * @return 创建后的成员
     */
    SysWorkspaceMember createMember(CreateWorkspaceMemberCmd cmd);

    /**
     * 根据工作空间ID和用户ID查询成员
     *
     * @param workspaceId 工作空间ID
     * @param userId 用户ID
     * @return 成员信息
     */
    SysWorkspaceMember findByWorkspaceAndUser(String workspaceId, String userId);

    /**
     * 统计某工作空间内使用指定角色的成员数量
     */
    long countByWorkspaceAndRoleId(String workspaceId, Long roleId);

    void removeByWorkspaceId(String workspaceId);
}
