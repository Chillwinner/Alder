/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.System.domain.SysRole;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/**
 * 角色表 Mapper（{@code sys_role}）。业务查询优先使用 {@link com.xddcodec.fs.system.service.SysRoleService}。
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
public interface SysRoleMapper {
    @Select("SELECT * FROM sys_role WHERE id = #{id}")
    SysRole selectById(@Param("id") Long id);

    int insert(SysRole row);

    int updateById(SysRole row);


    @Select("SELECT * FROM sys_role WHERE workspace_id = #{workspaceId}")
    List<SysRole> selectByWorkspaceId(@Param("workspaceId") String workspaceId);

    @Select("SELECT * FROM sys_role WHERE id = #{id} AND workspace_id = #{workspaceId}")
    SysRole selectByIdAndWorkspaceId(@Param("id") Long id, @Param("workspaceId") String workspaceId);

    @Select("SELECT COUNT(1) FROM sys_role WHERE workspace_id = #{workspaceId} AND role_code = #{roleCode}")
    long countByWorkspaceIdAndRoleCode(@Param("workspaceId") String workspaceId,
                                       @Param("roleCode") String roleCode);

    int deleteByIds(@Param("ids") Collection<Long> ids);
}
