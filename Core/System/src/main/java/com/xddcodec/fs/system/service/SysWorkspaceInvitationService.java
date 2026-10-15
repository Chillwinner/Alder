/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.SysWorkspaceInvitation;
import com.xddcodec.fs.System.domain.dto.CreateInvitationCmd;
import com.xddcodec.fs.System.domain.vo.InvitationDetailVO;
import com.xddcodec.fs.System.domain.vo.WorkspaceInvitationVO;

import java.util.List;

/**
 * 工作空间邀请服务接口
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
public interface SysWorkspaceInvitationService {

    /**
     * 获取工作空间的邀请列表
     *
     * @param workspaceId 工作空间ID
     * @return 邀请列表
     */
    List<WorkspaceInvitationVO> getInvitations(String workspaceId);

    /**
     * 创建邀请
     *
     * @param workspaceId 工作空间ID
     * @param cmd 创建邀请命令
     * @param inviterId 邀请人ID
     * @return 邀请VO
     */
    WorkspaceInvitationVO createInvitation(String workspaceId, CreateInvitationCmd cmd, String inviterId);

    /**
     * 取消邀请
     *
     * @param invitationId 邀请ID
     * @param workspaceId 工作空间ID
     */
    void cancelInvitation(String invitationId, String workspaceId);

    /**
     * 根据 token 查询邀请
     *
     * @param token 邀请令牌
     * @return 邀请信息
     */
    SysWorkspaceInvitation findByToken(String token);

    /**
     * 验证邀请令牌并获取邀请详情
     *
     * @param token 邀请令牌
     * @return 邀请详情
     */
    InvitationDetailVO verifyInvitation(String token);

    /**
     * 接受邀请
     *
     * @param token 邀请令牌
     * @param userId 用户ID
     */
    void acceptInvitation(String token, String userId);

    /**
     * 当前登录用户待处理的工作空间邀请
     */
    List<InvitationDetailVO> listPendingForCurrentUser(String userId);

    /**
     * 受邀人拒绝邀请
     */
    void rejectInvitation(String token, String userId);
}
