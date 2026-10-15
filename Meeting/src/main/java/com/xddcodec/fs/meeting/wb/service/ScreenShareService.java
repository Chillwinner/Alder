package com.xddcodec.fs.meeting.wb.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 房间级屏幕分享锁：同一时间只允许一人分享。
 */
@Service
public class ScreenShareService {

    public record Sharer(String peerId, String name, String sessionId) {}

    public record ClearedShare(String roomId, Sharer sharer) {}

    private final ConcurrentHashMap<String, Sharer> sharers = new ConcurrentHashMap<>();

    public Optional<Sharer> getSharer(String roomId) {
        return Optional.ofNullable(sharers.get(roomId));
    }

    /**
     * @return true 抢占成功；false 已有他人在分享
     */
    public boolean tryStart(String roomId, String peerId, String name, String sessionId) {
        Sharer next = new Sharer(peerId, name == null ? peerId : name, sessionId);
        Sharer prev = sharers.putIfAbsent(roomId, next);
        if (prev == null) {
            return true;
        }
        if (prev.peerId().equals(peerId)) {
            sharers.put(roomId, next);
            return true;
        }
        return false;
    }

    public boolean stop(String roomId, String peerId) {
        Sharer cur = sharers.get(roomId);
        if (cur == null) {
            return false;
        }
        if (!cur.peerId().equals(peerId)) {
            return false;
        }
        return sharers.remove(roomId, cur);
    }

    public Optional<ClearedShare> clearBySession(String sessionId) {
        for (Map.Entry<String, Sharer> e : sharers.entrySet()) {
            if (sessionId.equals(e.getValue().sessionId())) {
                if (sharers.remove(e.getKey(), e.getValue())) {
                    return Optional.of(new ClearedShare(e.getKey(), e.getValue()));
                }
            }
        }
        return Optional.empty();
    }
}
