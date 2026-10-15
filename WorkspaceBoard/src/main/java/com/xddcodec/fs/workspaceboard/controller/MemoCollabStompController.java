/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import com.xddcodec.fs.workspaceboard.domain.dto.MemoSyncPayload;
import com.xddcodec.fs.workspaceboard.service.MemoAccessService;
import com.xddcodec.fs.workspaceboard.service.MemoCollabService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class MemoCollabStompController {

    private final MemoCollabService collabService;
    private final MemoAccessService accessService;

    @MessageMapping("/memo/sync")
    public void sync(@Valid @Payload MemoSyncPayload payload, Principal principal) {
        bind(payload.getMemoId(), principal);
        collabService.handleSync(UserContext.getUserId(), payload);
    }

    @MessageMapping("/memo/join")
    public void join(@Payload MemoSyncPayload payload, Principal principal, SimpMessageHeaderAccessor accessor) {
        bind(payload.getMemoId(), principal);
        accessor.getSessionAttributes().put("memoId", payload.getMemoId());
        collabService.onJoin(payload.getMemoId());
    }

    @MessageMapping("/memo/leave")
    public void leave(@Payload MemoSyncPayload payload, Principal principal) {
        bind(payload.getMemoId(), principal);
        collabService.onLeave(payload.getMemoId());
    }

    private void bind(String memoId, Principal principal) {
        String userId = resolveUserId(principal);
        WorkspaceMemo memo = accessService.requireMemoForCollab(memoId, userId);
        WorkspaceContext.setWorkspaceId(memo.getWorkspaceId());
        UserContext.setUserId(userId);
    }

    private String resolveUserId(Principal principal) {
        if (principal == null) {
            return UserContext.getUserId();
        }
        String name = principal.getName();
        return name != null && name.startsWith("u:") ? name.substring(2) : name;
    }
}
