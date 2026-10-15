/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.listener;

import com.xddcodec.fs.System.domain.event.WorkspaceCreatedEvent;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WorkspaceFileshareListener {

    private final WorkspaceFileshareService workspaceFileshareService;

    @EventListener
    public void onWorkspaceCreated(WorkspaceCreatedEvent event) {
        workspaceFileshareService.ensureFileshareFolder(event.getWorkspaceId(), event.getOwnerUserId());
        workspaceFileshareService.ensureRagFolder(event.getWorkspaceId(), event.getOwnerUserId());
    }
}
