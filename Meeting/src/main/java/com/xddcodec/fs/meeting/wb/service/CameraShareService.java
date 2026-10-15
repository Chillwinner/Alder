package com.xddcodec.fs.meeting.wb.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 房间级摄像头座位。人数不设上限，房主关闭会议前都可以开。
 */
@Service
public class CameraShareService {

    public record Publisher(String peerId, String name, String sessionId) {}

    public record ClearedCamera(String roomId, Publisher publisher) {}

    private final ConcurrentHashMap<String, ConcurrentHashMap<String, Publisher>> rooms =
            new ConcurrentHashMap<>();

    public List<Publisher> list(String roomId) {
        ConcurrentHashMap<String, Publisher> map = rooms.get(roomId);
        if (map == null || map.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(map.values());
    }

    /**
     * @return true 抢座成功；false 已满或被他人占用失败
     */
    public boolean tryStart(String roomId, String peerId, String name, String sessionId) {
        if (roomId == null || roomId.isBlank() || peerId == null || peerId.isBlank()) {
            return false;
        }
        ConcurrentHashMap<String, Publisher> map =
                rooms.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        Publisher next = new Publisher(peerId, name == null ? peerId : name, sessionId);

        Publisher existing = map.get(peerId);
        if (existing != null) {
            map.put(peerId, next);
            return true;
        }
        map.put(peerId, next);
        return true;
    }

    public boolean stop(String roomId, String peerId) {
        ConcurrentHashMap<String, Publisher> map = rooms.get(roomId);
        if (map == null || peerId == null) {
            return false;
        }
        boolean removed = map.remove(peerId) != null;
        if (map.isEmpty()) {
            rooms.remove(roomId, map);
        }
        return removed;
    }

    public List<ClearedCamera> clearBySession(String sessionId) {
        List<ClearedCamera> cleared = new ArrayList<>();
        if (sessionId == null) {
            return cleared;
        }
        for (Map.Entry<String, ConcurrentHashMap<String, Publisher>> roomEntry : rooms.entrySet()) {
            String roomId = roomEntry.getKey();
            ConcurrentHashMap<String, Publisher> map = roomEntry.getValue();
            for (Map.Entry<String, Publisher> e : map.entrySet()) {
                if (sessionId.equals(e.getValue().sessionId())) {
                    if (map.remove(e.getKey(), e.getValue())) {
                        cleared.add(new ClearedCamera(roomId, e.getValue()));
                    }
                }
            }
            if (map.isEmpty()) {
                rooms.remove(roomId, map);
            }
        }
        return cleared;
    }

    public Optional<List<Publisher>> publishers(String roomId) {
        List<Publisher> list = list(roomId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list);
    }
}
