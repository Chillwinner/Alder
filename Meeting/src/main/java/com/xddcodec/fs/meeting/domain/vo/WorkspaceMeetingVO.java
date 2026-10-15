/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.domain.vo;

import lombok.Data;

import java.util.List;

@Data
public class WorkspaceMeetingVO {
    private String id;
    private String workspaceId;
    private String workspaceName;
    private String workspaceSlug;
    private String roomId;
    private String title;
    private String startsAt;
    private String createdBy;
    private String creatorName;
    private String createdAt;
    /** SCHEDULED / OPEN / CLOSED */
    private String status;
    private boolean canEnter;
    private boolean host;
    private List<String> participantUserIds;
}
