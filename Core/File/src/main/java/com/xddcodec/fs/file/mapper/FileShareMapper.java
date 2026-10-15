/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.File.domain.FileShare;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/**
 * 文件分享数据访问层接口
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
public interface FileShareMapper {
    @Select("SELECT * FROM file_shares WHERE id = #{id}")
    FileShare selectById(@Param("id") String id);

    int insert(FileShare row);


    List<FileShare> selectPage(@Param("workspaceId") String workspaceId,
                               @Param("keyword") String keyword,
                               @Param("orderBy") String orderBy,
                               @Param("isAsc") Boolean isAsc);

    @Select("SELECT * FROM file_shares WHERE id = #{id} AND workspace_id = #{workspaceId}")
    FileShare selectByIdAndWorkspace(@Param("id") String id, @Param("workspaceId") String workspaceId);

    List<FileShare> selectByIdsAndWorkspace(@Param("ids") Collection<String> ids,
                                            @Param("workspaceId") String workspaceId);

    @Select("SELECT * FROM file_shares WHERE workspace_id = #{workspaceId}")
    List<FileShare> selectByWorkspaceId(@Param("workspaceId") String workspaceId);

    int deleteByIds(@Param("ids") Collection<String> ids);
}
