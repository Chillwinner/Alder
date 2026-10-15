/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.vo;

import lombok.Data;

@Data
public class WorkspaceAiReminderInboxVO {
    private String id;
    private String reminderId;
    private String workspaceId;
    private String workspaceName;
    private String message;
    private String firedAt;
}