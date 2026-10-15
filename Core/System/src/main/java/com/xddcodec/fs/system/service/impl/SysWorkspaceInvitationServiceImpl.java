/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Mail.MailService;
import com.xddcodec.fs.System.domain.*;
import com.xddcodec.fs.System.domain.dto.CreateInvitationCmd;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceMemberCmd;
import com.xddcodec.fs.System.domain.vo.InvitationDetailVO;
import com.xddcodec.fs.System.domain.vo.WorkspaceInvitationVO;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceInvitationMapper;
import com.xddcodec.fs.system.service.SysRoleService;
import com.xddcodec.fs.system.service.SysWorkspaceInvitationService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import com.xddcodec.fs.system.service.SysWorkspaceService;
import com.xddcodec.fs.push.RealtimeUserPushPublisher;
import com.xddcodec.fs.site.SiteSettingsKeys;
import com.xddcodec.fs.site.SiteSettingsRuntime;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 工作空间邀请服务实现
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SysWorkspaceInvitationServiceImpl implements SysWorkspaceInvitationService {

    private final SysWorkspaceInvitationMapper invitationMapper;
    private final Converter converter;
    private final SysRoleService roleService;
    private final SysWorkspaceMemberService memberService;
    private final SysWorkspaceService workspaceService;
    private final SysUserMapper userMapper;
    private final MailService mailService;
    private final RealtimeUserPushPublisher realtimeUserPushPublisher;
    private final SiteSettingsRuntime siteSettingsRuntime;

    @Value("${fs.frontend.domain}")
    private String frontendUrl;

    @Override
    public List<WorkspaceInvitationVO> getInvitations(String workspaceId) {
        return invitationMapper.selectByWorkspaceId(workspaceId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WorkspaceInvitationVO createInvitation(String workspaceId, CreateInvitationCmd cmd, String inviterId) {
        // 验证工作空间是否存在
        SysWorkspace workspace = workspaceService.getById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_EXIST);
        }

        // 验证角色是否存在
        SysRole role = roleService.getRoleById(cmd.getRoleId());
        if (role == null) {
            throw new BusinessException(ErrorMessages.ROLE_NOT_EXIST);
        }

        // 获取邀请者信息
        SysUser inviter = userMapper.selectById(inviterId);
        if (inviter == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }

        // 检查被邀请的邮箱是否已注册，如果已注册则检查是否已经是成员
        SysUser invitedUser = userMapper.selectByEmail(cmd.getEmail());
        if (invitedUser != null) {
            SysWorkspaceMember existingMember = memberService.findByWorkspaceAndUser(workspaceId, invitedUser.getId());
            if (existingMember != null) {
                throw new BusinessException(ErrorMessages.INVITATION_ALREADY_MEMBER);
            }
        }

        // 检查是否存在待处理的邀请
        SysWorkspaceInvitation existingInvitation =
                invitationMapper.selectPendingByWorkspaceAndEmail(workspaceId, cmd.getEmail());
        if (existingInvitation != null) {
            throw new BusinessException(ErrorMessages.INVITATION_ALREADY_PENDING);
        }

        // 生成邀请令牌
        String token = UUID.randomUUID().toString().replace("-", "");

        // 创建邀请
        SysWorkspaceInvitation invitation = new SysWorkspaceInvitation();
        invitation.setWorkspaceId(workspaceId);
        invitation.setEmail(cmd.getEmail());
        invitation.setRoleId(cmd.getRoleId());
        invitation.setInvitedBy(inviterId);
        invitation.setToken(token);
        invitation.setStatus(0); // 待接受
        invitation.setExpiresAt(LocalDateTime.now().plusHours(cmd.getExpiresHours()));
        invitation.setId(UUID.randomUUID().toString().replace("-", ""));
        invitationMapper.insert(invitation);

        // 生成邀请链接（从配置中获取前端地址）
        String inviteLink = siteSettingsRuntime.getOrDefault(SiteSettingsKeys.FRONTEND_DOMAIN, frontendUrl)
                + "/invite?token=" + token;

        // 发送邀请邮件
        mailService.sendWorkspaceInvite(
                cmd.getEmail(),
                inviter.getNickname(),
                workspace.getName(),
                role.getRoleName(),
                inviteLink
        );

        if (invitedUser != null) {
            realtimeUserPushPublisher.publish(
                    invitedUser.getId(),
                    RealtimeUserPushPublisher.TYPE_WORKSPACE_INVITATION
            );
        }

        return converter.convert(invitation, WorkspaceInvitationVO.class);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelInvitation(String invitationId, String workspaceId) {
        SysWorkspaceInvitation invitation = invitationMapper.selectById(invitationId);
        if (invitation == null) {
            throw new BusinessException(ErrorMessages.INVITATION_NOT_EXIST);
        }

        if (!invitation.getWorkspaceId().equals(workspaceId)) {
            throw new BusinessException(ErrorMessages.INVITATION_NO_PERMISSION);
        }

        // 更新状态为已取消
        invitation.setStatus(3);
        invitationMapper.updateById(invitation);
    }

    @Override
    public SysWorkspaceInvitation findByToken(String token) {
        return invitationMapper.selectByToken(token);
    }

    @Override
    public InvitationDetailVO verifyInvitation(String token) {
        SysWorkspaceInvitation invitation = invitationMapper.selectDetailByToken(token);
        requirePending(invitation, true);
        return toInvitationDetail(invitation, userMapper.selectByEmail(invitation.getEmail()) != null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void acceptInvitation(String token, String userId) {
        SysWorkspaceInvitation invitation = requirePending(findByToken(token), true);
        SysUser user = requireUser(userId);
        if (!invitation.getEmail().equals(user.getEmail())) {
            throw new BusinessException(ErrorMessages.INVITATION_EMAIL_MISMATCH);
        }
        if (memberService.findByWorkspaceAndUser(invitation.getWorkspaceId(), userId) != null) {
            throw new BusinessException(ErrorMessages.INVITATION_ALREADY_MEMBER);
        }

        CreateWorkspaceMemberCmd memberCmd = new CreateWorkspaceMemberCmd();
        memberCmd.setWorkspaceId(invitation.getWorkspaceId());
        memberCmd.setUserId(userId);
        memberCmd.setRoleId(invitation.getRoleId());
        memberService.createMember(memberCmd);

        invitation.setStatus(1);
        invitation.setAcceptedAt(LocalDateTime.now());
        invitationMapper.updateById(invitation);

        SysWorkspace workspace = workspaceService.getById(invitation.getWorkspaceId());
        if (workspace != null) {
            workspace.setMemberCount(workspace.getMemberCount() + 1);
            workspaceService.updateById(workspace);
        }
    }

    @Override
    public List<InvitationDetailVO> listPendingForCurrentUser(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return List.of();
        }
        List<SysWorkspaceInvitation> rows =
                invitationMapper.selectPendingDetailsByEmail(user.getEmail().trim());
        return rows.stream().map(row -> toInvitationDetail(row, true)).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void rejectInvitation(String token, String userId) {
        SysWorkspaceInvitation invitation = requirePending(findByToken(token), true);
        SysUser user = requireUser(userId);
        if (!invitation.getEmail().equalsIgnoreCase(user.getEmail())) {
            throw new BusinessException(ErrorMessages.INVITATION_NO_PERMISSION);
        }
        invitation.setStatus(3);
        invitationMapper.updateById(invitation);
    }

    private SysWorkspaceInvitation requirePending(SysWorkspaceInvitation invitation, boolean markExpired) {
        if (invitation == null) {
            throw new BusinessException(ErrorMessages.INVITATION_NOT_EXIST);
        }
        if (invitation.getStatus() != 0) {
            throw new BusinessException(ErrorMessages.INVITATION_INVALID);
        }
        if (invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            if (markExpired) {
                invitation.setStatus(2);
                invitationMapper.updateById(invitation);
            }
            throw new BusinessException(ErrorMessages.INVITATION_EXPIRED);
        }
        return invitation;
    }

    private SysUser requireUser(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        return user;
    }

    private InvitationDetailVO toInvitationDetail(SysWorkspaceInvitation invitation, boolean userExists) {
        return InvitationDetailVO.builder()
                .id(invitation.getId())
                .token(invitation.getToken())
                .workspaceId(invitation.getWorkspaceId())
                .workspaceName(invitation.getWorkspaceName())
                .email(invitation.getEmail())
                .roleName(invitation.getRoleName())
                .roleCode(invitation.getRoleCode())
                .inviterName(invitation.getInviterName())
                .status(invitation.getStatus())
                .expiresAt(invitation.getExpiresAt())
                .expired(invitation.getExpiresAt().isBefore(LocalDateTime.now()))
                .createdAt(invitation.getCreatedAt())
                .userExists(userExists)
                .build();
    }
}
