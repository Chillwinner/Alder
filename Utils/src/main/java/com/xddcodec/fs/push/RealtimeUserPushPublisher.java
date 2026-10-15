/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 经 Redis 发布用户级实时推送，由 Conversation 模块转发到 WebSocket（/user/queue/conversation）。
 */
@Component
@RequiredArgsConstructor
public class RealtimeUserPushPublisher {

    /** 与 Conversation ImConstants.CHANNEL 一致 */
    public static final String CHANNEL = "fs:conversation:events";

    public static final String TYPE_FRIEND_REQUEST = "FRIEND_REQUEST";
    public static final String TYPE_WORKSPACE_INVITATION = "WORKSPACE_INVITATION";
    public static final String TYPE_FILE_COLLECTION_SUBMISSION = "FILE_COLLECTION_SUBMISSION";
    public static final String TYPE_FILE_COLLECTION_ASSIGNED = "FILE_COLLECTION_ASSIGNED";
    public static final String TYPE_WORKSPACE_VOTE = "WORKSPACE_VOTE";
    public static final String TYPE_WORKSPACE_MEETING = "WORKSPACE_MEETING";
    public static final String TYPE_WORKSPACE_MEETING_PRE15 = "WORKSPACE_MEETING_PRE15";
    public static final String TYPE_WORKSPACE_AI_REMINDER = "WORKSPACE_AI_REMINDER";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public void publish(String userId, String type) {
        publish(userId, type, null);
    }

    public void publish(String userId, String type, Map<String, Object> extra) {
        if (userId == null || userId.isBlank() || type == null || type.isBlank()) {
            return;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", type);
            payload.put("userId", userId);
            if (extra != null && !extra.isEmpty()) {
                payload.putAll(extra);
            }
            stringRedisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(payload));
        } catch (Exception ignored) {
            // best-effort
        }
    }
}
