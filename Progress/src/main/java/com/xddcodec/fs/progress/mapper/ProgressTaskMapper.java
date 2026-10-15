/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.mapper;

import com.xddcodec.fs.progress.domain.ProgressTask;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

public interface ProgressTaskMapper {

    int insert(ProgressTask task);

    ProgressTask selectById(@Param("id") String id);

    List<ProgressTask> list(
            @Param("workspaceId") String workspaceId,
            @Param("mineUserId") String mineUserId,
            @Param("kind") String kind,
            @Param("status") String status,
            @Param("keyword") String keyword,
            @Param("onDate") LocalDate onDate,
            @Param("includeOpen") boolean includeOpen);

    int updateTask(ProgressTask task);

    int deleteSubmissionFiles(@Param("id") String id);

    int deleteSubmissions(@Param("id") String id);

    int deleteAssignees(@Param("id") String id);

    int deleteById(@Param("id") String id);

    int insertAssignee(@Param("taskId") String taskId, @Param("userId") String userId);

    List<String> listAssigneeIds(@Param("taskId") String taskId);

    List<String> listTodayDailyTaskIds(
            @Param("workspaceId") String workspaceId,
            @Param("day") LocalDate day);
}
