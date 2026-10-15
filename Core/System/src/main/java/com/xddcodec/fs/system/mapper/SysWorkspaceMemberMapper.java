/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 工作空间成员 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
public interface SysWorkspaceMemberMapper {
    @Delete("DELETE FROM sys_workspace_member WHERE id = #{id}")
    int deleteById(@Param("id") Long id);

    int insert(SysWorkspaceMember row);

    int updateById(SysWorkspaceMember row);


    @Select("SELECT * FROM sys_workspace_member WHERE workspace_id = #{workspaceId} AND user_id = #{userId}")
    SysWorkspaceMember findByWorkspaceAndUser(@Param("workspaceId") String workspaceId,
                                              @Param("userId") String userId);

    List<WorkspaceMemberVO> selectMembers(@Param("workspaceId") String workspaceId,
                                          @Param("keyword") String keyword);

    @Select("SELECT COUNT(1) FROM sys_workspace_member WHERE workspace_id = #{workspaceId} AND role_id = #{roleId}")
    long countByWorkspaceAndRoleId(@Param("workspaceId") String workspaceId,
                                   @Param("roleId") Long roleId);

    @Delete("DELETE FROM sys_workspace_member WHERE workspace_id = #{workspaceId}")
    int deleteByWorkspaceId(@Param("workspaceId") String workspaceId);
}
