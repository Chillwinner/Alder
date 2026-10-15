/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateProgressTaskCmd {
    private String title;
    private String description;
    private String kind;
    /** 前端 datetime-local 或 ISO，可空 */
    private String dueAt;
    private List<String> assigneeIds;
}
