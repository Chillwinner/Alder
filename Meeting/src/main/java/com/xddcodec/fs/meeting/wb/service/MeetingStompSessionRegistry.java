package com.xddcodec.fs.meeting.wb.service;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * STOMP 会话对应的登录用户名（u:{userId}）。
 * wbroom 原来把 sessionId 当成 principal，这里要发到现有握手 principal 上。
 */
@Component
public class MeetingStompSessionRegistry {

    private final ConcurrentHashMap<String, String> sessionToUser = new ConcurrentHashMap<>();

    public void bind(String sessionId, String userName) {
        if (sessionId == null || sessionId.isBlank() || userName == null || userName.isBlank()) {
            return;
        }
        sessionToUser.put(sessionId, userName);
    }

    public void unbind(String sessionId) {
        if (sessionId != null) {
            sessionToUser.remove(sessionId);
        }
    }

    public String userName(String sessionId) {
        return sessionId == null ? null : sessionToUser.get(sessionId);
    }
}
