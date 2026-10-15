/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.mapper;

import com.xddcodec.fs.progress.domain.ProgressDayHit;
import com.xddcodec.fs.progress.domain.ProgressSubmission;

import java.util.List;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;

public interface ProgressSubmissionMapper {

    int insert(ProgressSubmission row);

    ProgressSubmission selectById(@Param("id") String id);

    ProgressSubmission selectLatestPending(@Param("taskId") String taskId);

    ProgressSubmission selectDaily(@Param("taskId") String taskId, @Param("day") LocalDate day);

    int updateReview(@Param("id") String id, @Param("reviewStatus") String reviewStatus);

    int insertFile(@Param("submissionId") String submissionId, @Param("fileId") String fileId);

    List<ProgressDayHit> listHits(
            @Param("workspaceId") String workspaceId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
