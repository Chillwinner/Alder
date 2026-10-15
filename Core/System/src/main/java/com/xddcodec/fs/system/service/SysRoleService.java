/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.SysRole;
import com.xddcodec.fs.System.domain.dto.CreateCustomRoleCmd;
import com.xddcodec.fs.System.domain.dto.CreateRoleCmd;
import com.xddcodec.fs.System.domain.dto.UpdateCustomRoleCmd;
import com.xddcodec.fs.System.domain.vo.SysPermissionVO;
import com.xddcodec.fs.System.domain.vo.SysRoleVO;

import java.util.Collection;
import java.util.List;

/**
 * 角色与权限。Sa-Token 通过 {@code StpInterface} 读取这里的 roleCode / permissionCode。
 */
public interface SysRoleService {

    List<SysRoleVO> getListByWorkspace(String workspaceId);

    List<SysRole> listByWorkspaceId(String workspaceId);

    void removeByIds(Collection<Long> ids);

    SysRole createRole(CreateRoleCmd cmd);

    SysRole getRoleById(Long roleId);

    SysRoleVO createCustomRole(String workspaceId, CreateCustomRoleCmd cmd);

    SysRoleVO updateCustomRole(String workspaceId, Long roleId, UpdateCustomRoleCmd cmd);

    void deleteCustomRole(String workspaceId, Long roleId);

    SysRoleVO getRoleDetail(String workspaceId, Long roleId);

    List<String> getPermissionCodesByRoleId(Long roleId);

    List<SysPermissionVO> listPermissions();
}
