/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.workspaceboard.service.MemoAccessService;
import com.xddcodec.fs.workspaceboard.service.MemoBoardSseHub;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/workspace-board")
@Tag(name = "工作空间协作页 SSE")
public class MemoBoardSseController {

    private final MemoBoardSseHub sseHub;
    private final MemoAccessService accessService;

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "协作页元数据 SSE（列表页）")
    public SseEmitter events() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        accessService.assertMember(userId, workspaceId);
        return sseHub.subscribe(workspaceId, userId);
    }
}
