/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WorkspaceMemo {
    private String id;
    private String workspaceId;
    private String title;
    private String createdBy;
    private String visibility;
    private String bodyHtml;
    private String bodyMd;
    private String fileId;
    private Integer sortOrder;
    private Boolean pinned;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
