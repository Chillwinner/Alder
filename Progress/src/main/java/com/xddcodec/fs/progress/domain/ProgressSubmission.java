/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ProgressSubmission {
    private String id;
    private String taskId;
    private String userId;
    private LocalDate day;
    private Integer progressBefore;
    private Integer progressAfter;
    private String reviewStatus;
    private String note;
    private LocalDateTime createdAt;
}
