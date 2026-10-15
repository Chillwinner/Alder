/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.domain;

import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class WorkspaceMeetingRow {
    private String id;
    private String workspaceId;
    private String workspaceName;
    private String workspaceSlug;
    private String roomId;
    private String title;
    private OffsetDateTime startsAt;
    private String createdBy;
    private String creatorName;
    private OffsetDateTime invitePushedAt;
    private OffsetDateTime pre15PushedAt;
    private String status;
    private OffsetDateTime createdAt;
}
