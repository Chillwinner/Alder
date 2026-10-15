/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.system.constant.WorkspaceRoleConstants;
import com.xddcodec.fs.System.domain.SysPermission;
import com.xddcodec.fs.System.domain.SysRole;
import com.xddcodec.fs.System.domain.SysRolePermission;
import com.xddcodec.fs.System.domain.dto.CreateCustomRoleCmd;
import com.xddcodec.fs.System.domain.dto.CreateRoleCmd;
import com.xddcodec.fs.System.domain.dto.UpdateCustomRoleCmd;
import com.xddcodec.fs.System.domain.vo.SysPermissionVO;
import com.xddcodec.fs.System.domain.vo.SysRoleVO;
import com.xddcodec.fs.system.mapper.SysPermissionMapper;
import com.xddcodec.fs.system.mapper.SysRoleMapper;
import com.xddcodec.fs.system.mapper.SysRolePermissionMapper;
import com.xddcodec.fs.system.service.SysRoleService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysRoleServiceImpl implements SysRoleService {

    private final SysRoleMapper roleMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final SysPermissionMapper permissionMapper;
    private final Converter converter;

    @Lazy
    @Autowired
    private SysWorkspaceMemberService workspaceMemberService;

    @Override
    public List<SysRoleVO> getListByWorkspace(String workspaceId) {
        List<SysRole> list = roleMapper.selectByWorkspaceId(workspaceId);
        list.sort(Comparator
                .comparing((SysRole r) -> isSystemRole(r) ? 0 : 1)
                .thenComparing(SysRoleServiceImpl::presetSortKey)
                .thenComparing(SysRole::getId, Comparator.nullsLast(Long::compareTo)));
        return converter.convert(list, SysRoleVO.class);
    }

    @Override
    public List<SysRole> listByWorkspaceId(String workspaceId) {
        return roleMapper.selectByWorkspaceId(workspaceId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "rolePermissions", allEntries = true)
    public void removeByIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        rolePermissionMapper.deleteByRoleIds(ids);
        roleMapper.deleteByIds(ids);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysRole createRole(CreateRoleCmd cmd) {
        SysRole role = new SysRole();
        role.setWorkspaceId(cmd.getWorkspaceId());
        role.setRoleCode(cmd.getRoleCode());
        role.setRoleName(cmd.getRoleName());
        role.setDescription(cmd.getDescription());
        role.setRoleType(cmd.getRoleType() != null ? cmd.getRoleType() : WorkspaceRoleConstants.TYPE_CUSTOM);
        roleMapper.insert(role);
        replacePermissions(role.getId(), role.getRoleCode(), cmd.getPermissions());
        return role;
    }

    @Override
    public SysRole getRoleById(Long roleId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (workspaceId != null) {
            return roleMapper.selectByIdAndWorkspaceId(roleId, workspaceId);
        }
        return roleMapper.selectById(roleId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysRoleVO createCustomRole(String workspaceId, CreateCustomRoleCmd cmd) {
        String code = cmd.getRoleCode().trim();
        if (WorkspaceRoleConstants.isReservedRoleCode(code)) {
            throw new BusinessException(ErrorMessages.ROLE_CODE_RESERVED);
        }
        if (roleMapper.countByWorkspaceIdAndRoleCode(workspaceId, code) > 0) {
            throw new BusinessException(ErrorMessages.ROLE_CODE_EXISTS);
        }
        validatePermissionCodes(cmd.getPermissions());

        CreateRoleCmd inner = new CreateRoleCmd();
        inner.setWorkspaceId(workspaceId);
        inner.setRoleCode(code);
        inner.setRoleName(cmd.getRoleName().trim());
        inner.setDescription(cmd.getDescription());
        inner.setRoleType(WorkspaceRoleConstants.TYPE_CUSTOM);
        inner.setPermissions(cmd.getPermissions());
        return toDetailVo(createRole(inner));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "rolePermissions", key = "#roleId")
    public SysRoleVO updateCustomRole(String workspaceId, Long roleId, UpdateCustomRoleCmd cmd) {
        SysRole role = requireCustomRole(workspaceId, roleId);
        validatePermissionCodes(cmd.getPermissions());
        role.setRoleName(cmd.getRoleName().trim());
        role.setDescription(cmd.getDescription());
        roleMapper.updateById(role);
        replacePermissions(role.getId(), role.getRoleCode(), cmd.getPermissions());
        return toDetailVo(roleMapper.selectById(role.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "rolePermissions", key = "#roleId")
    public void deleteCustomRole(String workspaceId, Long roleId) {
        requireCustomRole(workspaceId, roleId);
        if (workspaceMemberService.countByWorkspaceAndRoleId(workspaceId, roleId) > 0) {
            throw new BusinessException(ErrorMessages.ROLE_IN_USE);
        }
        removeByIds(List.of(roleId));
    }

    @Override
    public SysRoleVO getRoleDetail(String workspaceId, Long roleId) {
        SysRole role = roleMapper.selectByIdAndWorkspaceId(roleId, workspaceId);
        if (role == null) {
            throw new BusinessException(ErrorMessages.ROLE_NOT_EXIST);
        }
        return toDetailVo(role);
    }

    @Override
    @Cacheable(value = "rolePermissions", key = "#roleId", unless = "#result == null || #result.isEmpty()")
    public List<String> getPermissionCodesByRoleId(Long roleId) {
        return rolePermissionMapper.selectByRoleId(roleId).stream()
                .map(SysRolePermission::getPermissionCode)
                .collect(Collectors.toList());
    }

    @Override
    @Cacheable(value = "permissions", key = "'all'")
    public List<SysPermissionVO> listPermissions() {
        return converter.convert(permissionMapper.selectAll(), SysPermissionVO.class);
    }

    private void replacePermissions(Long roleId, String roleCode, List<String> permissionCodes) {
        rolePermissionMapper.deleteByRoleId(roleId);
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            return;
        }
        for (String permissionCode : permissionCodes) {
            SysRolePermission rp = new SysRolePermission();
            rp.setRoleId(roleId);
            rp.setRoleCode(roleCode);
            rp.setPermissionCode(permissionCode);
            rolePermissionMapper.insert(rp);
        }
    }

    private static boolean isSystemRole(SysRole r) {
        return r.getRoleType() != null && r.getRoleType() == WorkspaceRoleConstants.TYPE_SYSTEM;
    }

    private static int presetSortKey(SysRole r) {
        String code = r.getRoleCode();
        if (code == null) {
            return 99;
        }
        return switch (code.toLowerCase()) {
            case WorkspaceRoleConstants.CODE_ADMIN -> 0;
            case WorkspaceRoleConstants.CODE_MEMBER -> 1;
            case WorkspaceRoleConstants.CODE_VIEWER -> 2;
            default -> 50;
        };
    }

    private SysRole requireCustomRole(String workspaceId, Long roleId) {
        SysRole role = roleMapper.selectByIdAndWorkspaceId(roleId, workspaceId);
        if (role == null) {
            throw new BusinessException(ErrorMessages.ROLE_NOT_EXIST);
        }
        if (!Objects.equals(role.getRoleType(), WorkspaceRoleConstants.TYPE_CUSTOM)) {
            throw new BusinessException(ErrorMessages.ROLE_SYSTEM_CANNOT_EDIT);
        }
        return role;
    }

    private void validatePermissionCodes(List<String> codes) {
        Set<String> allowed = permissionMapper.selectAll().stream()
                .map(SysPermission::getPermissionCode)
                .collect(Collectors.toSet());
        for (String c : codes) {
            if (!allowed.contains(c)) {
                throw new BusinessException(ErrorMessages.ROLE_PERMISSION_INVALID);
            }
        }
    }

    private SysRoleVO toDetailVo(SysRole role) {
        SysRoleVO vo = converter.convert(role, SysRoleVO.class);
        vo.setPermissions(getPermissionCodesByRoleId(role.getId()));
        return vo;
    }
}
