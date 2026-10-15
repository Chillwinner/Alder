/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.workspaceboard.domain.dto.MemoSyncPayload;
import com.xddcodec.fs.workspaceboard.support.BoardConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Base64;

@Service
@RequiredArgsConstructor
public class MemoCollabService {

    private final MemoAccessService accessService;
    private final MemoSyncRedisService syncRedis;
    private final MemoPersistenceService persistenceService;
    private final SimpMessagingTemplate messaging;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public void handleSync(String userId, MemoSyncPayload payload) {
        accessService.requireMemoForCollab(payload.getMemoId(), userId);
        String type = payload.getType() == null ? "" : payload.getType().toUpperCase();
        payload.setType(type);

        if ("SNAPSHOT".equals(type)) {
            syncRedis.storeSnapshot(payload.getMemoId(), Base64.getDecoder().decode(payload.getPayloadBase64()));
            publishRedis(payload);
        } else if ("UPDATE".equals(type)) {
            syncRedis.markDirty(payload.getMemoId());
        }
        messaging.convertAndSend(BoardConstants.memoTopic(payload.getMemoId()), payload);
    }

    public MemoSyncPayload buildInitialSync(String memoId) {
        byte[] state = persistenceService.loadInitialState(memoId);
        if (state == null || state.length == 0) {
            return null;
        }
        MemoSyncPayload payload = new MemoSyncPayload();
        payload.setMemoId(memoId);
        payload.setType("SNAPSHOT");
        payload.setPayloadBase64(Base64.getEncoder().encodeToString(state));
        return payload;
    }

    public void onJoin(String memoId) {
        syncRedis.incrementActive(memoId);
    }

    public void onLeave(String memoId) {
        if (syncRedis.decrementActive(memoId) <= 0) {
            persistenceService.flushMemo(memoId);
        }
    }

    private void publishRedis(MemoSyncPayload payload) {
        try {
            redis.convertAndSend(BoardConstants.REDIS_CHANNEL, objectMapper.writeValueAsString(payload));
        } catch (Exception ignored) {
        }
    }
}
