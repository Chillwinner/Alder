/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.mapper;

import com.xddcodec.fs.ai.domain.WorkspaceAiSettings;
import org.apache.ibatis.annotations.Param;

public interface WorkspaceAiSettingsMapper {

    void ensureTable();

    WorkspaceAiSettings selectByWorkspace(@Param("workspaceId") String workspaceId);

    int upsert(WorkspaceAiSettings settings);
}
