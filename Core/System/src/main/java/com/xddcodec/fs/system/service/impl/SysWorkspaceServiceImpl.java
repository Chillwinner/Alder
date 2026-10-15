/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.system.constant.WorkspaceRoleConstants;
import com.xddcodec.fs.System.domain.*;
import com.xddcodec.fs.System.domain.dto.CreateRoleCmd;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceCmd;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceMemberCmd;
import com.xddcodec.fs.System.domain.dto.UpdateWorkspaceCmd;
import com.xddcodec.fs.System.domain.vo.WorkspaceDetailVO;
import com.xddcodec.fs.System.domain.vo.WorkspaceVO;
import com.xddcodec.fs.system.mapper.SysWorkspaceInvitationMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.system.service.*;
import io.github.linpeilie.Converter;
import com.xddcodec.fs.System.domain.event.WorkspaceCreatedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.Serializable;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 工作空间表 服务层实现
 *
 * @author xddcode
 * @date 2026/3/30 10:11
 */
@Service
@RequiredArgsConstructor
public class SysWorkspaceServiceImpl implements SysWorkspaceService {

    private final SysWorkspaceMapper workspaceMapper;
    private final Converter converter;
    private final SysRoleService roleService;
    private final SysWorkspaceMemberService memberService;
    private final SysWorkspaceInvitationMapper invitationMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public SysWorkspace getById(Serializable id) {
        return workspaceMapper.selectById(id == null ? null : id.toString());
    }

    @Override
    public void updateById(SysWorkspace workspace) {
        workspaceMapper.updateById(workspace);
    }

    @Override
    public List<WorkspaceVO> getWorkspacesByUser(String userId) {
        List<SysWorkspace> workspaces = workspaceMapper.selectByUserId(userId);
        return converter.convert(workspaces, WorkspaceVO.class);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WorkspaceVO createWorkspace(CreateWorkspaceCmd cmd) {
        String userId = UserContext.getUserId();

        // 1. 创建 workspace
        SysWorkspace workspace = new SysWorkspace();
        workspace.setName(cmd.getName());
        workspace.setSlug(cmd.getSlug());
        workspace.setDescription(cmd.getDescription());
        workspace.setOwnerId(userId);
        workspace.setMemberCount(1);
        workspace.setId(UUID.randomUUID().toString().replace("-", ""));
        workspaceMapper.insert(workspace);

        // 2. 创建系统预设角色：管理员、普通成员、受限成员
        List<String> allCodes = roleService.listPermissions().stream()
                .map(p -> p.getPermissionCode())
                .collect(Collectors.toList());

        CreateRoleCmd adminCmd = new CreateRoleCmd();
        adminCmd.setWorkspaceId(workspace.getId());
        adminCmd.setRoleCode(WorkspaceRoleConstants.CODE_ADMIN);
        adminCmd.setRoleName(WorkspaceRoleConstants.CODE_ADMIN);
        adminCmd.setDescription("");
        adminCmd.setRoleType(WorkspaceRoleConstants.TYPE_SYSTEM);
        adminCmd.setPermissions(allCodes);
        SysRole adminRole = roleService.createRole(adminCmd);

        CreateRoleCmd memberCmd = new CreateRoleCmd();
        memberCmd.setWorkspaceId(workspace.getId());
        memberCmd.setRoleCode(WorkspaceRoleConstants.CODE_MEMBER);
        memberCmd.setRoleName(WorkspaceRoleConstants.CODE_MEMBER);
        memberCmd.setDescription("");
        memberCmd.setRoleType(WorkspaceRoleConstants.TYPE_SYSTEM);
        memberCmd.setPermissions(List.of("file:read", "file:write", "file:share"));
        roleService.createRole(memberCmd);

        CreateRoleCmd viewerCmd = new CreateRoleCmd();
        viewerCmd.setWorkspaceId(workspace.getId());
        viewerCmd.setRoleCode(WorkspaceRoleConstants.CODE_VIEWER);
        viewerCmd.setRoleName(WorkspaceRoleConstants.CODE_VIEWER);
        viewerCmd.setDescription("");
        viewerCmd.setRoleType(WorkspaceRoleConstants.TYPE_SYSTEM);
        viewerCmd.setPermissions(List.of("file:read"));
        roleService.createRole(viewerCmd);

        // 3. 创建者加入工作空间并绑定管理员角色
        CreateWorkspaceMemberCmd workspaceMemberCmd = new CreateWorkspaceMemberCmd();
        workspaceMemberCmd.setWorkspaceId(workspace.getId());
        workspaceMemberCmd.setUserId(userId);
        workspaceMemberCmd.setRoleId(adminRole.getId());
        memberService.createMember(workspaceMemberCmd);

        eventPublisher.publishEvent(new WorkspaceCreatedEvent(this, workspace.getId(), userId));

        return converter.convert(workspace, WorkspaceVO.class);
    }

    @Override
    public WorkspaceDetailVO getCurrentDetail(String workspaceId, String userId) {
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_EXIST);
        }

        SysWorkspaceMember member = memberService.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_MEMBER);
        }

        WorkspaceDetailVO vo = new WorkspaceDetailVO();
        vo.setId(workspace.getId());
        vo.setName(workspace.getName());
        vo.setSlug(workspace.getSlug());
        vo.setDescription(workspace.getDescription());
        vo.setOwnerId(workspace.getOwnerId());
        vo.setMemberCount(workspace.getMemberCount());
        vo.setCreatedAt(workspace.getCreatedAt());
        vo.setUpdatedAt(workspace.getUpdatedAt());
        vo.setLocalQuotaBytes(workspace.getLocalQuotaBytes());

        SysRole role = roleService.getRoleById(member.getRoleId());
        if (role != null) {
            vo.setRoleCode(role.getRoleCode());
            vo.setRoleName(role.getRoleName());
            vo.setPermissions(roleService.getPermissionCodesByRoleId(role.getId()));
        }

        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public WorkspaceVO updateWorkspace(String workspaceId, UpdateWorkspaceCmd cmd) {
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_EXIST);
        }

        workspace.setName(cmd.getName());
        workspace.setDescription(cmd.getDescription());
        if (cmd.getLocalQuotaGb() != null) {
            double gb = cmd.getLocalQuotaGb();
            if (gb < 0.1 || gb > 10240) {
                throw new BusinessException(ErrorMessages.STORAGE_CONFIG_ERROR);
            }
            workspace.setLocalQuotaBytes(Math.round(gb * 1024d * 1024d * 1024d));
        }
        workspaceMapper.updateById(workspace);

        return converter.convert(workspace, WorkspaceVO.class);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteWorkspace(String workspaceId, String userId) {
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_EXIST);
        }

        if (!workspace.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorMessages.WORKSPACE_ONLY_OWNER_CAN_DELETE);
        }

        // 级联删除：邀请 → 成员 → 角色权限 → 角色 → 工作空间
        invitationMapper.deleteByWorkspaceId(workspaceId);
        memberService.removeByWorkspaceId(workspaceId);

        List<SysRole> roles = roleService.listByWorkspaceId(workspaceId);
        if (!roles.isEmpty()) {
            roleService.removeByIds(roles.stream().map(SysRole::getId).toList());
        }

        workspaceMapper.deleteById(workspaceId);
    }

    @Override
    public boolean checkSlug(String slug) {
        return workspaceMapper.countBySlug(slug) == 0;
    }
}
