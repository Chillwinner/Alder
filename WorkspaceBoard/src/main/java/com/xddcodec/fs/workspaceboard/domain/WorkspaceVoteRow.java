/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WorkspaceVoteRow {
    private String id;
    private String workspaceId;
    private String workspaceName;
    private String workspaceSlug;
    private String title;
    private String createdBy;
    private String creatorName;
    private LocalDateTime createdAt;
    private Integer agreeCount;
    private Integer disagreeCount;
    private Integer pendingCount;
    private String myChoice;
}
