/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth;

import cn.dev33.satoken.stp.StpInterface;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.System.domain.SysRole;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.system.service.SysRoleService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Sa-Token RBAC 数据源：当前工作空间成员的 roleCode / permissionCode。
 */
@Component
@RequiredArgsConstructor
public class StpInterfaceImpl implements StpInterface {

    private final SysWorkspaceMemberService memberService;
    private final SysRoleService roleService;

    @Override
    public List<String> getPermissionList(Object loginId, String loginType) {
        SysWorkspaceMember member = currentMember(loginId);
        if (member == null) {
            return List.of();
        }
        List<String> permissions = roleService.getPermissionCodesByRoleId(member.getRoleId());
        return permissions != null ? permissions : List.of();
    }

    @Override
    public List<String> getRoleList(Object loginId, String loginType) {
        SysWorkspaceMember member = currentMember(loginId);
        if (member == null) {
            return List.of();
        }
        SysRole role = roleService.getRoleById(member.getRoleId());
        return role != null ? List.of(role.getRoleCode()) : List.of();
    }

    private SysWorkspaceMember currentMember(Object loginId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (workspaceId == null || workspaceId.isBlank()) {
            return null;
        }
        return memberService.findByWorkspaceAndUser(workspaceId, String.valueOf(loginId));
    }
}
