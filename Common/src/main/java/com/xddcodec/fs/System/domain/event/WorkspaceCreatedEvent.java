/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class WorkspaceCreatedEvent extends ApplicationEvent {

    private final String workspaceId;
    private final String ownerUserId;

    public WorkspaceCreatedEvent(Object source, String workspaceId, String ownerUserId) {
        super(source);
        this.workspaceId = workspaceId;
        this.ownerUserId = ownerUserId;
    }
}
