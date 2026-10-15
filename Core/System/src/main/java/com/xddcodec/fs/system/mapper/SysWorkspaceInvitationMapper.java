/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.System.domain.SysWorkspaceInvitation;
import com.xddcodec.fs.System.domain.vo.WorkspaceInvitationVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 工作空间邀请 mapper 接口
 *
 * @author xddcode
 * @date 2023/08/07
 */
public interface SysWorkspaceInvitationMapper {
    @Select("SELECT * FROM sys_workspace_invitation WHERE id = #{id}")
    SysWorkspaceInvitation selectById(@Param("id") String id);

    int insert(SysWorkspaceInvitation row);

    int updateById(SysWorkspaceInvitation row);


    List<WorkspaceInvitationVO> selectByWorkspaceId(@Param("workspaceId") String workspaceId);

    @Select("SELECT * FROM sys_workspace_invitation WHERE workspace_id = #{workspaceId} AND email = #{email} AND status = 0 AND expires_at > NOW()")
    SysWorkspaceInvitation selectPendingByWorkspaceAndEmail(@Param("workspaceId") String workspaceId,
                                                            @Param("email") String email);

    @Select("SELECT * FROM sys_workspace_invitation WHERE token = #{token}")
    SysWorkspaceInvitation selectByToken(@Param("token") String token);

    SysWorkspaceInvitation selectDetailByToken(@Param("token") String token);

    List<SysWorkspaceInvitation> selectPendingDetailsByEmail(@Param("email") String email);

    @Delete("DELETE FROM sys_workspace_invitation WHERE workspace_id = #{workspaceId}")
    int deleteByWorkspaceId(@Param("workspaceId") String workspaceId);
}
