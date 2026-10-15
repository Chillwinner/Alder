/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Delete;
import com.xddcodec.fs.System.domain.SysWorkspace;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 工作空间表 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
public interface SysWorkspaceMapper {
    @Select("SELECT * FROM sys_workspace WHERE id = #{id}")
    SysWorkspace selectById(@Param("id") String id);

    @Delete("DELETE FROM sys_workspace WHERE id = #{id}")
    int deleteById(@Param("id") String id);

    int insert(SysWorkspace row);

    int updateById(SysWorkspace row);

    void updateFileshareFolderId(@Param("workspaceId") String workspaceId,
                                 @Param("fileshareFolderId") String fileshareFolderId);

    void updateRagFolderId(@Param("workspaceId") String workspaceId,
                           @Param("ragFolderId") String ragFolderId);

    List<SysWorkspace> selectByUserId(@Param("userId") String userId);

    @Select("SELECT COUNT(1) FROM sys_workspace WHERE slug = #{slug}")
    long countBySlug(@Param("slug") String slug);

    @Select("SELECT * FROM sys_workspace")
    List<SysWorkspace> selectAll();
}
