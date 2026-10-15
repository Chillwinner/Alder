package com.xddcodec.fs.meeting.wb.service;

import com.xddcodec.fs.meeting.wb.dto.CreateRoomResponse;
import com.xddcodec.fs.meeting.wb.dto.RoomStatusResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class RoomService {

    private static final String KEY_ACTIVE_ROOMS = "rooms:active";
    private static final String META_PREFIX = "room:%s:meta";
    private static final String ELEMENTS_PREFIX = "room:%s:elements";
    private static final String FILES_PREFIX = "room:%s:files";
    private static final String KIT_PREFIX = "room:%s:kit";
    private static final String SNAPSHOT_PREFIX = "room:%s:snapshot";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_CLOSED = "CLOSED";

    @Autowired
    private StringRedisTemplate redis;

    @Value("${whiteboard.max-rooms:50}")
    private int maxRooms;

    @Value("${whiteboard.room-ttl-hours:1}")
    private int roomTtlHours;

    @Value("${whiteboard.snapshot-ttl-minutes:15}")
    private int snapshotTtlMinutes;

    public CreateRoomResponse createRoom() {
        return createRoom(null);
    }

    public CreateRoomResponse createRoom(String preferredId) {
        reconcileActiveCountIfNeeded();

        Long count = redis.opsForValue().increment(KEY_ACTIVE_ROOMS);
        if (count != null && count > maxRooms) {
            redis.opsForValue().decrement(KEY_ACTIVE_ROOMS);
            // 计数漂移时再对账一次后重试判断
            long live = countLiveRooms();
            redis.opsForValue().set(KEY_ACTIVE_ROOMS, String.valueOf(live));
            if (live >= maxRooms) {
                throw new IllegalStateException("房间数已达上限 " + maxRooms);
            }
            count = redis.opsForValue().increment(KEY_ACTIVE_ROOMS);
            if (count != null && count > maxRooms) {
                redis.opsForValue().decrement(KEY_ACTIVE_ROOMS);
                throw new IllegalStateException("房间数已达上限 " + maxRooms);
            }
        }

        String roomId;
        if (preferredId != null && !preferredId.isBlank()) {
            if (!preferredId.matches("^[A-Za-z0-9_-]{1,20}$")) {
                redis.opsForValue().decrement(KEY_ACTIVE_ROOMS);
                throw new IllegalStateException("房间号格式无效");
            }
            if (roomExists(preferredId)) {
                redis.opsForValue().decrement(KEY_ACTIVE_ROOMS);
                throw new IllegalStateException("房间号已存在");
            }
            roomId = preferredId;
        } else {
            roomId = generateRoomId();
        }

        // 清理同名残留，避免复用房间号时带回旧画板/图片/快照
        redis.delete(keySnapshot(roomId));
        redis.delete(keyElements(roomId));
        redis.delete(keyFiles(roomId));
        redis.delete(keyKit(roomId));

        String adminToken = UUID.randomUUID().toString().replace("-", "");

        Map<String, String> meta = new HashMap<>();
        meta.put("adminToken", adminToken);
        meta.put("status", STATUS_ACTIVE);
        meta.put("createdAt", Instant.now().toString());
        meta.put("closedAt", "");

        String metaKey = keyMeta(roomId);
        redis.opsForHash().putAll(metaKey, meta);
        touchRoomTtl(roomId);

        log.info("房间创建: roomId={}, ttl={}h", roomId, roomTtlHours);
        return new CreateRoomResponse(roomId, adminToken);
    }

    public boolean roomExists(String roomId) {
        return Boolean.TRUE.equals(redis.hasKey(keyMeta(roomId)));
    }

    public boolean hasSnapshot(String roomId) {
        return Boolean.TRUE.equals(redis.hasKey(keySnapshot(roomId)));
    }

    public boolean isRoomActive(String roomId) {
        Object status = redis.opsForHash().get(keyMeta(roomId), "status");
        return STATUS_ACTIVE.equals(status);
    }

    /**
     * ACTIVE = live room, CLOSED = room gone but PNG snapshot still downloadable, null = gone.
     */
    public String getRoomStatus(String roomId) {
        Object status = redis.opsForHash().get(keyMeta(roomId), "status");
        if (status != null) {
            return status.toString();
        }
        if (hasSnapshot(roomId)) {
            return STATUS_CLOSED;
        }
        return null;
    }

    public String getAdminToken(String roomId) {
        Object token = redis.opsForHash().get(keyMeta(roomId), "adminToken");
        return token != null ? token.toString() : null;
    }

    public void setCurrentPageId(String roomId, String pageId) {
        if (roomId == null || pageId == null || pageId.isBlank()) {
            return;
        }
        redis.opsForHash().put(keyMeta(roomId), "currentPageId", pageId);
        touchRoomTtl(roomId);
    }

    public String getCurrentPageId(String roomId) {
        Object pageId = redis.opsForHash().get(keyMeta(roomId), "currentPageId");
        return pageId != null ? pageId.toString() : null;
    }

    public String getCreatedAt(String roomId) {
        Object createdAt = redis.opsForHash().get(keyMeta(roomId), "createdAt");
        return createdAt != null ? createdAt.toString() : null;
    }

    public RoomStatusResponse getRoomStatusInfo(String roomId) {
        String status = getRoomStatus(roomId);
        if (status == null) {
            return null;
        }
        Instant created = parseInstant(getCreatedAt(roomId));
        Instant expires = resolveExpiresAt(roomId);
        return new RoomStatusResponse(
                status,
                created != null ? created.toString() : null,
                expires != null ? expires.toString() : null
        );
    }

    /**
     * 工作空间会议：房主手动关房前一直有效，不套 wbroom 的房间时限。
     */
    public void activateForMeeting(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return;
        }
        if (isRoomActive(roomId)) {
            persistRoom(roomId);
            return;
        }
        redis.delete(keySnapshot(roomId));
        Map<String, String> meta = new HashMap<>();
        meta.put("adminToken", "alder-host");
        meta.put("status", STATUS_ACTIVE);
        meta.put("createdAt", Instant.now().toString());
        meta.put("closedAt", "");
        meta.put("persistent", "1");
        redis.opsForHash().putAll(keyMeta(roomId), meta);
        redis.opsForValue().increment(KEY_ACTIVE_ROOMS);
        persistRoom(roomId);
        log.info("会议房间开启: roomId={}", roomId);
    }

    private boolean persistent(String roomId) {
        return "1".equals(redis.opsForHash().get(keyMeta(roomId), "persistent"));
    }

    private void persistRoom(String roomId) {
        redis.persist(keyMeta(roomId));
        redis.persist(keyElements(roomId));
        redis.persist(keyFiles(roomId));
        redis.persist(keyKit(roomId));
    }

    public Instant resolveExpiresAt(String roomId) {
        if (persistent(roomId)) {
            return null;
        }
        Instant created = parseInstant(getCreatedAt(roomId));
        if (created != null) {
            return created.plus(Duration.ofHours(roomTtlHours));
        }
        Long ttl = redis.getExpire(keyMeta(roomId), TimeUnit.SECONDS);
        if (ttl != null && ttl > 0) {
            return Instant.now().plusSeconds(ttl);
        }
        return null;
    }

    private Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Close room immediately: delete meta/elements, free slot, keep optional PNG for a short TTL.
     */
    public void closeRoom(String roomId, byte[] pngSnapshot) {
        String metaKey = keyMeta(roomId);
        String elementsKey = keyElements(roomId);
        String filesKey = keyFiles(roomId);
        boolean wasActive = isRoomActive(roomId);

        redis.delete(metaKey);
        redis.delete(elementsKey);
        redis.delete(filesKey);
        redis.delete(keyKit(roomId));

        if (wasActive) {
            Long left = redis.opsForValue().decrement(KEY_ACTIVE_ROOMS);
            if (left != null && left < 0) {
                redis.opsForValue().set(KEY_ACTIVE_ROOMS, "0");
            }
        }

        if (pngSnapshot != null && pngSnapshot.length > 0) {
            try {
                saveSnapshot(roomId, pngSnapshot);
                log.info("房间关闭: roomId={}, 已释放席位, 快照保留{}min ({} bytes)",
                        roomId, snapshotTtlMinutes, pngSnapshot.length);
            } catch (Exception e) {
                log.warn("房间关闭: roomId={}, 快照未保存: {}", roomId, e.getMessage());
                redis.delete(keySnapshot(roomId));
            }
        } else {
            redis.delete(keySnapshot(roomId));
            log.info("房间关闭: roomId={}, 已释放席位, 无快照", roomId);
        }
    }

    public void saveSnapshot(String roomId, byte[] pngBytes) {
        if (pngBytes == null || pngBytes.length < 8 || !isPng(pngBytes)) {
            throw new IllegalArgumentException("快照不是有效 PNG");
        }
        byte[] key = keySnapshot(roomId).getBytes(StandardCharsets.UTF_8);
        long seconds = Duration.ofMinutes(snapshotTtlMinutes).getSeconds();
        // StringRedisTemplate.execute 会包一层字符串连接，UTF-8 会弄坏 PNG 二进制
        RedisConnection conn = redis.getRequiredConnectionFactory().getConnection();
        try {
            conn.stringCommands().setEx(key, seconds, pngBytes);
        } finally {
            conn.close();
        }
    }

    public byte[] getSnapshot(String roomId) {
        byte[] key = keySnapshot(roomId).getBytes(StandardCharsets.UTF_8);
        RedisConnection conn = redis.getRequiredConnectionFactory().getConnection();
        try {
            byte[] raw = conn.stringCommands().get(key);
            if (raw == null || raw.length == 0 || !isPng(raw)) {
                return null;
            }
            return raw;
        } finally {
            conn.close();
        }
    }

    private static boolean isPng(byte[] bytes) {
        return bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4e
                && bytes[3] == 0x47
                && bytes[4] == 0x0d
                && bytes[5] == 0x0a
                && bytes[6] == 0x1a
                && bytes[7] == 0x0a;
    }

    public Map<Object, Object> getAllElements(String roomId) {
        return redis.opsForHash().entries(keyElements(roomId));
    }

    public Map<Object, Object> getAllFiles(String roomId) {
        return redis.opsForHash().entries(keyFiles(roomId));
    }

    public void setKit(String roomId, String field, String json) {
        if (roomId == null || field == null || json == null) {
            return;
        }
        redis.opsForHash().put(keyKit(roomId), field, json);
        touchRoomTtl(roomId);
    }

    public String getKit(String roomId, String field) {
        Object raw = redis.opsForHash().get(keyKit(roomId), field);
        return raw != null ? raw.toString() : null;
    }

    public void deleteKit(String roomId, String field) {
        redis.opsForHash().delete(keyKit(roomId), field);
        touchRoomTtl(roomId);
    }

    public void setElement(String roomId, String elementId, String elementJson) {
        redis.opsForHash().put(keyElements(roomId), elementId, elementJson);
        touchRoomTtl(roomId);
    }

    public void setFile(String roomId, String fileId, String fileJson) {
        redis.opsForHash().put(keyFiles(roomId), fileId, fileJson);
        touchRoomTtl(roomId);
    }

    public void deleteElement(String roomId, String elementId) {
        redis.opsForHash().delete(keyElements(roomId), elementId);
        touchRoomTtl(roomId);
    }

    /** 清空房间全部图元与图片文件（一键清板） */
    public void clearAllElements(String roomId) {
        redis.delete(keyElements(roomId));
        redis.delete(keyFiles(roomId));
        touchRoomTtl(roomId);
    }

    /** Keep meta + elements + files TTL aligned so orphan hashes do not linger. */
    public void touchRoomTtl(String roomId) {
        if (persistent(roomId)) {
            persistRoom(roomId);
            return;
        }
        Instant expires = resolveExpiresAt(roomId);
        long seconds = Duration.ofHours(roomTtlHours).getSeconds();
        if (expires != null) {
            seconds = Math.max(1, Duration.between(Instant.now(), expires).getSeconds());
        }
        Duration ttl = Duration.ofSeconds(seconds);
        redis.expire(keyMeta(roomId), ttl);
        redis.expire(keyElements(roomId), ttl);
        redis.expire(keyFiles(roomId), ttl);
        redis.expire(keyKit(roomId), ttl);
    }

    private void reconcileActiveCountIfNeeded() {
        String raw = redis.opsForValue().get(KEY_ACTIVE_ROOMS);
        long reported = 0;
        if (raw != null) {
            try {
                reported = Long.parseLong(raw);
            } catch (NumberFormatException ignored) {
                reported = 0;
            }
        }
        if (reported < maxRooms) {
            return;
        }
        long live = countLiveRooms();
        if (live != reported) {
            log.warn("rooms:active 对账: reported={}, live={}", reported, live);
            redis.opsForValue().set(KEY_ACTIVE_ROOMS, String.valueOf(live));
        }
    }

    private long countLiveRooms() {
        long n = 0;
        ScanOptions options = ScanOptions.scanOptions().match("room:*:meta").count(200).build();
        try (Cursor<byte[]> cursor = redis.execute(
                (RedisConnection conn) -> conn.keyCommands().scan(options))) {
            if (cursor == null) {
                return 0;
            }
            while (cursor.hasNext()) {
                cursor.next();
                n++;
            }
        } catch (Exception e) {
            log.warn("扫描房间 meta 失败，跳过对账", e);
            return 0;
        }
        return n;
    }

    private String keyMeta(String roomId) {
        return String.format(META_PREFIX, roomId);
    }

    private String keyElements(String roomId) {
        return String.format(ELEMENTS_PREFIX, roomId);
    }

    private String keyFiles(String roomId) {
        return String.format(FILES_PREFIX, roomId);
    }

    private String keyKit(String roomId) {
        return String.format(KIT_PREFIX, roomId);
    }

    private String keySnapshot(String roomId) {
        return String.format(SNAPSHOT_PREFIX, roomId);
    }

    private String generateRoomId() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder sb = new StringBuilder(8);
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        for (int i = 0; i < 8; i++) {
            sb.append(chars.charAt(rng.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
