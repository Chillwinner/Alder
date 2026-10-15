/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain.dto;

import lombok.Data;

@Data
public class UpdateProgressTaskCmd {
    private String title;
    private String description;
    private String kind;
    private String status;
    private Integer progress;
    private String dueAt;
    private String note;
}
