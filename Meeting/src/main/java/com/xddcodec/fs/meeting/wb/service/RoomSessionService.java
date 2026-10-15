package com.xddcodec.fs.meeting.wb.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 跟踪每个房间当前 WebSocket 会话数，用于人数上限。
 * 始终为房主预留 1 个席位：普通成员最多 max-1；房主可占用预留席直至 max。
 */
@Service
public class RoomSessionService {

    @Value("${whiteboard.max-sessions-per-room:500}")
    private int maxSessionsPerRoom;

    private final ConcurrentHashMap<String, Set<String>> roomSessions = new ConcurrentHashMap<>();
    /** 当前占用「房主席位」的 session（每房最多一个逻辑房主连接） */
    private final ConcurrentHashMap<String, String> roomAdminSession = new ConcurrentHashMap<>();

    public int getMaxSessionsPerRoom() {
        return maxSessionsPerRoom;
    }

    /**
     * @param isAdmin 是否持有有效 adminToken
     * @return true 加入成功；false 已满
     */
    public boolean tryJoin(String roomId, String sessionId, boolean isAdmin) {
        Set<String> set = roomSessions.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet());
        synchronized (set) {
            if (set.contains(sessionId)) {
                if (isAdmin) {
                    roomAdminSession.put(roomId, sessionId);
                }
                return true;
            }
            boolean adminPresent = isAdminPresentLocked(roomId, set);
            int limit = isAdmin || adminPresent ? maxSessionsPerRoom : Math.max(0, maxSessionsPerRoom - 1);
            if (set.size() >= limit) {
                return false;
            }
            set.add(sessionId);
            if (isAdmin) {
                roomAdminSession.put(roomId, sessionId);
            }
            return true;
        }
    }

    /** 兼容旧调用：按普通成员处理 */
    public boolean tryJoin(String roomId, String sessionId) {
        return tryJoin(roomId, sessionId, false);
    }

    public void leave(String roomId, String sessionId) {
        Set<String> set = roomSessions.get(roomId);
        if (set == null) {
            return;
        }
        synchronized (set) {
            set.remove(sessionId);
            roomAdminSession.compute(roomId, (k, adminSid) ->
                    sessionId.equals(adminSid) ? null : adminSid);
            if (set.isEmpty()) {
                roomSessions.remove(roomId, set);
                roomAdminSession.remove(roomId);
            }
        }
    }

    public void leaveAll(String sessionId) {
        for (Map.Entry<String, Set<String>> e : roomSessions.entrySet()) {
            String roomId = e.getKey();
            Set<String> set = e.getValue();
            synchronized (set) {
                if (!set.remove(sessionId)) {
                    continue;
                }
                roomAdminSession.compute(roomId, (k, adminSid) ->
                        sessionId.equals(adminSid) ? null : adminSid);
                if (set.isEmpty()) {
                    roomSessions.remove(roomId, set);
                    roomAdminSession.remove(roomId);
                }
            }
        }
    }

    private boolean isAdminPresentLocked(String roomId, Set<String> set) {
        String adminSid = roomAdminSession.get(roomId);
        return adminSid != null && set.contains(adminSid);
    }
}
