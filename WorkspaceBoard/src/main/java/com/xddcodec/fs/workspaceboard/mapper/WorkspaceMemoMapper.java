/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.mapper;

import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WorkspaceMemoMapper {

    int insert(WorkspaceMemo memo);

    int updateMeta(WorkspaceMemo memo);

    int softDelete(@Param("id") String id, @Param("workspaceId") String workspaceId);

    int restore(@Param("id") String id, @Param("workspaceId") String workspaceId);

    WorkspaceMemo selectDeletedByFileId(@Param("fileId") String fileId,
                                        @Param("workspaceId") String workspaceId);

    WorkspaceMemo selectById(@Param("id") String id);

    WorkspaceMemo selectMetaById(@Param("id") String id);

    WorkspaceMemo selectByIdAndWorkspace(@Param("id") String id, @Param("workspaceId") String workspaceId);

    List<WorkspaceMemo> selectByWorkspace(@Param("workspaceId") String workspaceId,
                                          @Param("userId") String userId);

    WorkspaceMemo selectByTitle(@Param("workspaceId") String workspaceId,
                                @Param("userId") String userId,
                                @Param("title") String title);

    WorkspaceMemo selectByFileId(@Param("fileId") String fileId,
                                 @Param("workspaceId") String workspaceId);

    int touchUpdatedAt(@Param("id") String id);

    String selectListSnippet(@Param("id") String id,
                             @Param("workspaceId") String workspaceId,
                             @Param("userId") String userId);
}
