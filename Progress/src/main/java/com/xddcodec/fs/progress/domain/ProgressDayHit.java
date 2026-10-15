/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain;

import lombok.Data;

import java.time.LocalDate;

@Data
public class ProgressDayHit {
    private String taskId;
    private String title;
    private String userId;
    private LocalDate day;
    private String reviewStatus;
    private String kind;
}
