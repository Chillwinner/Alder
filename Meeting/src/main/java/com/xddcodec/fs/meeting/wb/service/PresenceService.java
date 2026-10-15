package com.xddcodec.fs.meeting.wb.service;

import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * 画板光标 / 选区等 presence：只记 session → peer，便于断线时广播离开。
 * 不落 Redis，人走即无。
 */
@Service
public class PresenceService {

    public record PresencePeer(String roomId, String peerId) {}

    private final ConcurrentHashMap<String, PresencePeer> bySession = new ConcurrentHashMap<>();

    public void touch(String sessionId, String roomId, String peerId) {
        if (sessionId == null || sessionId.isBlank() || roomId == null || roomId.isBlank()
                || peerId == null || peerId.isBlank()) {
            return;
        }
        bySession.put(sessionId, new PresencePeer(roomId, peerId));
    }

    public PresencePeer remove(String sessionId) {
        if (sessionId == null) {
            return null;
        }
        return bySession.remove(sessionId);
    }
}
