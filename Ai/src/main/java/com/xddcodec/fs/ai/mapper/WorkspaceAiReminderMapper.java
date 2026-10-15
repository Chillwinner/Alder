/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.mapper;

import com.xddcodec.fs.ai.domain.WorkspaceAiReminder;
import com.xddcodec.fs.ai.domain.WorkspaceAiReminderInbox;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface WorkspaceAiReminderMapper {

    int insert(WorkspaceAiReminder row);

    List<WorkspaceAiReminder> selectByUserInWorkspace(
            @Param("workspaceId") String workspaceId, @Param("userId") String userId);

    WorkspaceAiReminder selectById(@Param("id") String id);

    int disable(@Param("id") String id, @Param("userId") String userId);

    List<WorkspaceAiReminder> selectDue(@Param("now") OffsetDateTime now);

    int claimFire(
            @Param("id") String id,
            @Param("now") OffsetDateTime now,
            @Param("nextFireAt") OffsetDateTime nextFireAt,
            @Param("enabled") boolean enabled);

    int insertInbox(WorkspaceAiReminderInbox row);

    List<WorkspaceAiReminderInbox> selectOpenInbox(@Param("userId") String userId);

    int dismissInbox(@Param("id") String id, @Param("userId") String userId);
}