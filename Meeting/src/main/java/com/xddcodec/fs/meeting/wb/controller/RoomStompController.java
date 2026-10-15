package com.xddcodec.fs.meeting.wb.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.meeting.config.MeetingWebSocketConfig;
import com.xddcodec.fs.meeting.service.WorkspaceMeetingService;
import com.xddcodec.fs.meeting.wb.service.CameraShareService;
import com.xddcodec.fs.meeting.wb.service.MeetingStompSessionRegistry;
import com.xddcodec.fs.meeting.wb.service.PresenceService;
import com.xddcodec.fs.meeting.wb.service.RoomKitService;
import com.xddcodec.fs.meeting.wb.service.RoomService;
import com.xddcodec.fs.meeting.wb.service.RoomSessionService;
import com.xddcodec.fs.meeting.wb.service.RoomStompService;
import com.xddcodec.fs.meeting.wb.service.ScreenShareService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Controller
public class RoomStompController {

    @Autowired
    private RoomStompService stompService;

    @Autowired
    private WorkspaceMeetingService meetingService;

    @Autowired
    private MeetingStompSessionRegistry sessions;

    @Autowired
    private RoomService roomService;

    @Autowired
    private RoomSessionService sessionService;

    @Autowired
    private ScreenShareService screenShareService;

    @Autowired
    private CameraShareService cameraShareService;

    @Autowired
    private PresenceService presenceService;

    @Autowired
    private RoomKitService kitService;

    @Autowired
    private SimpMessagingTemplate msg;

    /** presence 只转发、不落库；限制体积避免刷屏 */
    private static final int PRESENCE_MAX_CHARS = 8_000;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 语音信令中继（P2P）：只广播 VOICE_*，不落库。
     * 客户端用此通道交换 JOIN / OFFER / ANSWER / ICE / LEAVE。
     */
    @MessageMapping("/voice/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public JsonNode handleVoice(@DestinationVariable String roomId,
                                @Payload JsonNode node,
                                SimpMessageHeaderAccessor accessor) {
        if (!invited(roomId, accessor) || !roomService.isRoomActive(roomId)) {
            return null;
        }
        String type = node.path("type").asText("");
        if (!type.startsWith("VOICE_")) {
            log.warn("忽略非语音信令: type={}, roomId={}", type, roomId);
            return null;
        }
        return node;
    }

    /**
     * 屏幕分享信令（WebRTC 星型：一人推流，多人观看）。
     * SCREEN_START 带房间锁，同时只允许一人分享。
     */
    @MessageMapping("/screen/{roomId}")
    public void handleScreen(@DestinationVariable String roomId,
                             @Payload JsonNode node,
                             SimpMessageHeaderAccessor accessor) {
        if (!invited(roomId, accessor) || !roomService.isRoomActive(roomId)) {
            return;
        }
        String type = node.path("type").asText("");
        if (!type.startsWith("SCREEN_")) {
            log.warn("忽略非屏幕信令: type={}, roomId={}", type, roomId);
            return;
        }
        String sessionId = accessor.getSessionId();
        String from = node.path("from").asText("");
        String name = node.path("name").asText(from);

        if ("SCREEN_START".equals(type)) {
            if (sessionId == null || from.isBlank()) {
                return;
            }
            if (!screenShareService.tryStart(roomId, from, name, sessionId)) {
                String sharerName = screenShareService.getSharer(roomId)
                        .map(ScreenShareService.Sharer::name)
                        .orElse("");
                stompService.sendScreenBusyToUser(sessionId, sharerName);
                return;
            }
            log.info("屏幕分享开始: roomId={}, peerId={}", roomId, from);
        } else if ("SCREEN_STOP".equals(type)) {
            if (!from.isBlank()) {
                screenShareService.stop(roomId, from);
                log.info("屏幕分享结束: roomId={}, peerId={}", roomId, from);
            }
        }

        msg.convertAndSend("/topic/room/" + roomId, node);
    }

    /**
     * 摄像头信令：房间内最多 N 路同时开播；媒体协商仍走 VOICE_* renegotiate。
     */
    @MessageMapping("/camera/{roomId}")
    public void handleCamera(@DestinationVariable String roomId,
                             @Payload JsonNode node,
                             SimpMessageHeaderAccessor accessor) {
        if (!invited(roomId, accessor) || !roomService.isRoomActive(roomId)) {
            return;
        }
        String type = node.path("type").asText("");
        if (!type.startsWith("CAMERA_")) {
            log.warn("忽略非摄像头信令: type={}, roomId={}", type, roomId);
            return;
        }
        String sessionId = accessor.getSessionId();
        String from = node.path("from").asText("");
        String name = node.path("name").asText(from);

        if ("CAMERA_START".equals(type)) {
            if (sessionId == null || from.isBlank()) {
                return;
            }
            if (!cameraShareService.tryStart(roomId, from, name, sessionId)) {
                return;
            }
            log.info("摄像头开启: roomId={}, peerId={}", roomId, from);
        } else if ("CAMERA_STOP".equals(type)) {
            if (!from.isBlank()) {
                cameraShareService.stop(roomId, from);
                log.info("摄像头关闭: roomId={}, peerId={}", roomId, from);
            }
        } else if ("CAMERA_STATE".equals(type)) {
            // 客户端请求当前开播列表：只回给请求者
            if (sessionId != null) {
                stompService.sendCameraStateToUser(sessionId, roomId);
            }
            return;
        }

        msg.convertAndSend("/topic/room/" + roomId, node);
    }

    /**
     * 画板光标 / 选区 / 拖尾：只广播，不写入 Redis。
     */
    @MessageMapping("/presence/{roomId}")
    public void handlePresence(@DestinationVariable String roomId,
                               @Payload JsonNode node,
                               SimpMessageHeaderAccessor accessor) {
        if (!invited(roomId, accessor) || !roomService.isRoomActive(roomId) || node == null) {
            return;
        }
        String type = node.path("type").asText("");
        if (!"PRESENCE".equals(type) && !"PRESENCE_LEAVE".equals(type)) {
            return;
        }
        String from = node.path("from").asText("");
        if (from.isBlank()) {
            return;
        }
        if (node.toString().length() > PRESENCE_MAX_CHARS) {
            return;
        }
        String sessionId = accessor.getSessionId();
        if ("PRESENCE".equals(type)) {
            presenceService.touch(sessionId, roomId, from);
        } else {
            presenceService.remove(sessionId);
        }
        msg.convertAndSend("/topic/room/" + roomId, node);
    }

    /** 计时器 / 投票：持久化到房间 kit，广播全量状态。操控类仅房主。 */
    @MessageMapping("/kit/{roomId}")
    public void handleKit(@DestinationVariable String roomId,
                          @Payload JsonNode node,
                          SimpMessageHeaderAccessor accessor) {
        if (node == null || !invited(roomId, accessor)) {
            return;
        }
        String type = node.path("type").asText("");
        if (!"VOTE_CAST".equals(type) && !isKitAdmin(roomId, accessor)) {
            return;
        }
        JsonNode result = kitService.handle(roomId, node);
        if (result != null) {
            msg.convertAndSend("/topic/room/" + roomId, result);
        }
    }

    private String loginUserId(SimpMessageHeaderAccessor accessor) {
        if (accessor.getSessionAttributes() != null) {
            Object id = accessor.getSessionAttributes().get(MeetingWebSocketConfig.ATTR_USER_ID);
            if (id != null && !String.valueOf(id).isBlank()) {
                return String.valueOf(id);
            }
        }
        String name = accessor.getUser() != null ? accessor.getUser().getName() : null;
        if (name != null && name.startsWith("u:")) {
            return name.substring(2);
        }
        return null;
    }

    private boolean invited(String roomId, SimpMessageHeaderAccessor accessor) {
        String userId = loginUserId(accessor);
        try {
            meetingService.assertRoomParticipant(roomId, userId);
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private boolean isKitAdmin(String roomId, SimpMessageHeaderAccessor accessor) {
        String token = accessor.getFirstNativeHeader("admin-token");
        if (token == null || token.isBlank()) {
            token = accessor.getFirstNativeHeader("adminToken");
        }
        String stored = roomService.getAdminToken(roomId);
        return stored != null && stored.equals(token);
    }

    @MessageMapping("/draw/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public JsonNode handleDraw(@DestinationVariable String roomId,
                               @Payload JsonNode node,
                               SimpMessageHeaderAccessor accessor) {
        if (!invited(roomId, accessor)) {
            return null;
        }
        String type = node.path("type").asText("");
        try {
            if ("CLEAR".equals(type)) {
                String result = stompService.processClear(roomId);
                log.info("广播 CLEAR: roomId={}", roomId);
                return result == null ? null : objectMapper.readTree(result);
            }
            if ("PAGE".equals(type)) {
                String pageId = node.path("pageId").asText("");
                String result = stompService.processPage(roomId, pageId);
                return result == null ? null : objectMapper.readTree(result);
            }
            if ("FILE".equals(type)) {
                String fileId = node.path("fileId").asText("");
                if (fileId.isBlank()) {
                    return null;
                }
                String data = node.path("data").toString();
                String result = stompService.processFile(roomId, fileId, data);
                log.info("广播 FILE: fileId={}, roomId={}", fileId, roomId);
                return result == null ? null : objectMapper.readTree(result);
            }
            String elementId = node.path("elementId").asText("");
            if (elementId.isBlank()) {
                return null;
            }
            String resultJson = switch (type) {
                case "ADD", "UPDATE" -> {
                    String data = node.path("data").toString();
                    String result = stompService.processSaveOrDelete(roomId, type, elementId, data);
                    log.info("广播 {}: elementId={}, roomId={}", type, elementId, roomId);
                    yield result;
                }
                case "DELETE" -> {
                    String result = stompService.processDelete(roomId, elementId);
                    log.info("广播 DELETE: elementId={}, roomId={}", elementId, roomId);
                    yield result;
                }
                default -> {
                    log.warn("未知消息类型: {}", type);
                    yield null;
                }
            };
            return resultJson == null ? null : objectMapper.readTree(resultJson);
        } catch (Exception e) {
            log.error("消息处理失败: roomId={}", roomId, e);
            return null;
        }
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String dest = accessor.getDestination();
        String sessionId = accessor.getSessionId();
        if (dest == null || !dest.startsWith("/topic/room/") || sessionId == null) {
            return;
        }
        String roomId = dest.substring("/topic/room/".length());
        String userId = loginUserId(accessor);
        try {
            meetingService.assertRoomParticipant(roomId, userId);
        } catch (RuntimeException ex) {
            log.info("拒绝进入会议房间: roomId={}, user={}", roomId, userId);
            stompService.sendRoomNotFoundToUser(sessionId);
            return;
        }
        String adminToken = accessor.getFirstNativeHeader("admin-token");
        if (adminToken == null || adminToken.isBlank()) {
            adminToken = accessor.getFirstNativeHeader("adminToken");
        }
        String stored = roomService.getAdminToken(roomId);
        boolean isAdmin = stored != null && stored.equals(adminToken);
        log.info("用户订阅房间: sessionId={}, roomId={}, admin={}", sessionId, roomId, isAdmin);
        if (!roomService.isRoomActive(roomId)) {
            stompService.sendRoomNotFoundToUser(sessionId);
            return;
        }
        if (!sessionService.tryJoin(roomId, sessionId, isAdmin)) {
            stompService.sendRoomFullToUser(sessionId, sessionService.getMaxSessionsPerRoom());
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(300L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            // 关闭竞态：sleep 期间房间可能已被删
            if (!roomService.isRoomActive(roomId)) {
                sessionService.leave(roomId, sessionId);
                stompService.sendRoomNotFoundToUser(sessionId);
                return;
            }
            stompService.sendInitToUser(sessionId, roomId);
        });
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        if (sessionId == null) {
            return;
        }
        sessions.unbind(sessionId);
        sessionService.leaveAll(sessionId);
        PresenceService.PresencePeer left = presenceService.remove(sessionId);
        if (left != null) {
            Map<String, Object> leave = new HashMap<>();
            leave.put("type", "PRESENCE_LEAVE");
            leave.put("from", left.peerId());
            leave.put("reason", "disconnect");
            msg.convertAndSend("/topic/room/" + left.roomId(), leave);
        }
        screenShareService.clearBySession(sessionId).ifPresent(cleared -> {
            Map<String, Object> stop = new HashMap<>();
            stop.put("type", "SCREEN_STOP");
            stop.put("from", cleared.sharer().peerId());
            stop.put("name", cleared.sharer().name());
            stop.put("reason", "disconnect");
            msg.convertAndSend("/topic/room/" + cleared.roomId(), stop);
            log.info("分享者断线，已结束屏幕分享: roomId={}, peerId={}",
                    cleared.roomId(), cleared.sharer().peerId());
        });
        for (CameraShareService.ClearedCamera cleared : cameraShareService.clearBySession(sessionId)) {
            Map<String, Object> stop = new HashMap<>();
            stop.put("type", "CAMERA_STOP");
            stop.put("from", cleared.publisher().peerId());
            stop.put("name", cleared.publisher().name());
            stop.put("reason", "disconnect");
            msg.convertAndSend("/topic/room/" + cleared.roomId(), stop);
            log.info("开播者断线，已结束摄像头: roomId={}, peerId={}",
                    cleared.roomId(), cleared.publisher().peerId());
        }
        log.info("用户断开，释放房间席位: sessionId={}", sessionId);
    }
}
