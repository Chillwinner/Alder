/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AutoMapper(target = WorkspaceMemo.class)
public class WorkspaceMemoVO {
    private String id;
    private String title;
    private String createdBy;
    private String fileId;
    /** md | canvas，由 vault 后缀推导 */
    private String kind;
    private String visibility;
    private Boolean pinned;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
