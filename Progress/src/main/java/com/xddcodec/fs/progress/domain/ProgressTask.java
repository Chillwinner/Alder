/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProgressTask {
    private String id;
    private String workspaceId;
    private String title;
    private String description;
    private String kind;
    private String status;
    private Integer progress;
    private LocalDateTime dueAt;
    private String note;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
