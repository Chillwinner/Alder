/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.mapper;

import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WorkspaceBoardPinnedFileMapper {

    List<String> selectPinnedFileIds(@Param("workspaceId") String workspaceId);

    int insert(@Param("workspaceId") String workspaceId, @Param("fileId") String fileId);

    int delete(@Param("workspaceId") String workspaceId, @Param("fileId") String fileId);
}
