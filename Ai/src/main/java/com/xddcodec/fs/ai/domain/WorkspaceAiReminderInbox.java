/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain;

import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class WorkspaceAiReminderInbox {
    private String id;
    private String reminderId;
    private String workspaceId;
    private String workspaceName;
    private String userId;
    private String message;
    private OffsetDateTime firedAt;
    private Boolean dismissed;
}