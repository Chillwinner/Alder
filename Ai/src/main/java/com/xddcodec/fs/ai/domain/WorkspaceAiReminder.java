/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain;

import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
public class WorkspaceAiReminder {
    private String id;
    private String workspaceId;
    private String userId;
    private String message;
    private String kind;
    private Integer hour;
    private Integer minute;
    private LocalDate onceDate;
    private String weekdays;
    private String biweekParity;
    private LocalDate anchorMonday;
    private Boolean enabled;
    private OffsetDateTime nextFireAt;
}