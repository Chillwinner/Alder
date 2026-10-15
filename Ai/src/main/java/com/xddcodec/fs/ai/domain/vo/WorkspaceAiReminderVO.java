/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.vo;

import lombok.Data;

@Data
public class WorkspaceAiReminderVO {
    private String id;
    private String message;
    private String kind;
    private boolean enabled;
    private String nextFireAt;
    private String weekdays;
    private String biweekParity;
    private String onceDate;
    private Integer hour;
    private Integer minute;
}