/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoMetaEventVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceMemoVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
public class MemoBoardMetaPushService {

    private final MemoBoardSseHub sseHub;

    public void publishAfterCommit(String workspaceId, String event, WorkspaceMemo memo) {
        String actorId = UserContext.getUserId();
        afterCommit(() -> publishMeta(workspaceId, event, toEventVo(memo), actorId));
    }

    public void publishDeletedAfterCommit(String workspaceId, String memoId) {
        afterCommit(() -> {
            MemoMetaEventVO payload = new MemoMetaEventVO();
            payload.setEvent("deleted");
            payload.setMemoId(memoId);
            sseHub.broadcast(workspaceId, payload);
        });
    }

    public void publishMeta(String workspaceId, String event, WorkspaceMemoVO memo) {
        publishMeta(workspaceId, event, memo, UserContext.getUserId());
    }

    private void publishMeta(String workspaceId, String event, WorkspaceMemoVO memo, String actorId) {
        MemoMetaEventVO payload = new MemoMetaEventVO();
        payload.setEvent(event);
        payload.setMemoId(memo.getId());
        payload.setActorId(actorId);
        payload.setTitle(memo.getTitle());
        payload.setUpdatedAt(memo.getUpdatedAt());
        sseHub.broadcast(workspaceId, payload);
    }

    private static WorkspaceMemoVO toEventVo(WorkspaceMemo memo) {
        WorkspaceMemoVO vo = new WorkspaceMemoVO();
        vo.setId(memo.getId());
        vo.setTitle(memo.getTitle());
        vo.setCreatedBy(memo.getCreatedBy());
        vo.setPinned(memo.getPinned());
        vo.setUpdatedAt(memo.getUpdatedAt());
        return vo;
    }

    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            sseHub.dispatch(action);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                sseHub.dispatch(action);
            }
        });
    }
}
