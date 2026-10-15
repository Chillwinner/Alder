package com.xddcodec.fs.meeting.wb.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class RoomStompService {

    @Autowired
    private RoomService roomService;

    @Autowired
    private ScreenShareService screenShareService;

    @Autowired
    private CameraShareService cameraShareService;

    @Autowired
    private RoomKitService kitService;

    @Autowired
    private SimpMessagingTemplate msg;

    private void sendToSession(String sessionId, Object payload) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        msg.convertAndSendToUser(sessionId, "/queue/init", payload);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String processSaveOrDelete(String roomId, String type, String elementId, String data) {
        if (!roomService.roomExists(roomId)) {
            log.warn("拒绝写入不存在的房间: roomId={}, elementId={}", roomId, elementId);
            return null;
        }
        if (!roomService.isRoomActive(roomId)) {
            log.warn("拒绝写入已冻结的房间: roomId={}, elementId={}", roomId, elementId);
            return null;
        }
        try {
            if (objectMapper.readTree(data).path("isDeleted").asBoolean(false)) {
                roomService.deleteElement(roomId, elementId);
                log.info("拦截脏数据并纠正为 DELETE: elementId={}", elementId);
                return buildDeleteMessage(elementId);
            }
            roomService.setElement(roomId, elementId, data);
            return buildElementMessage(type, elementId, data);
        } catch (IOException e) {
            log.warn("图元数据解析失败: elementId={}", elementId);
            return null;
        }
    }

    public String processDelete(String roomId, String elementId) {
        if (!roomService.roomExists(roomId)) {
            log.warn("拒绝删除不存在的房间: roomId={}, elementId={}", roomId, elementId);
            return null;
        }
        if (!roomService.isRoomActive(roomId)) {
            log.warn("拒绝删除已冻结的房间: roomId={}, elementId={}", roomId, elementId);
            return null;
        }
        roomService.deleteElement(roomId, elementId);
        return buildDeleteMessage(elementId);
    }

    public String processClear(String roomId) {
        if (!roomService.roomExists(roomId)) {
            log.warn("拒绝清空不存在的房间: roomId={}", roomId);
            return null;
        }
        if (!roomService.isRoomActive(roomId)) {
            log.warn("拒绝清空已关闭的房间: roomId={}", roomId);
            return null;
        }
        Map<Object, Object> all = roomService.getAllElements(roomId);
        roomService.clearAllElements(roomId);
        all.forEach((k, v) -> {
            try {
                if ("page".equals(objectMapper.readTree(v.toString()).path("typeName").asText())) {
                    roomService.setElement(roomId, k.toString(), v.toString());
                }
            } catch (IOException e) {
                log.warn("清板时保留分页失败: elementId={}", k);
            }
        });
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", "CLEAR");
        return node.toString();
    }

    public String processPage(String roomId, String pageId) {
        if (!roomService.roomExists(roomId) || !roomService.isRoomActive(roomId)) {
            return null;
        }
        if (pageId == null || pageId.isBlank() || pageId.length() > 80) {
            return null;
        }
        roomService.setCurrentPageId(roomId, pageId);
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", "PAGE");
        node.put("pageId", pageId);
        return node.toString();
    }

    /**
     * 持久化并广播画板图片（dataURL）。
     * 消息形态: { type: "FILE", fileId, data: { id, dataURL, mimeType } }
     */
    public String processFile(String roomId, String fileId, String data) {
        if (!roomService.roomExists(roomId)) {
            log.warn("拒绝写入图片到不存在的房间: roomId={}, fileId={}", roomId, fileId);
            return null;
        }
        if (!roomService.isRoomActive(roomId)) {
            log.warn("拒绝写入图片到已关闭的房间: roomId={}, fileId={}", roomId, fileId);
            return null;
        }
        if (fileId == null || fileId.isBlank()) {
            return null;
        }
        // dataURL 约 4MB 上限，防止撑爆 Redis / WebSocket
        if (data != null && data.length() > 5_500_000) {
            log.warn("拒绝过大图片: roomId={}, fileId={}, bytes~={}", roomId, fileId, data.length());
            return null;
        }
        try {
            var tree = objectMapper.readTree(data);
            if (!tree.hasNonNull("dataURL") || tree.path("dataURL").asText("").isBlank()) {
                log.warn("图片缺少 dataURL: fileId={}", fileId);
                return null;
            }
            roomService.setFile(roomId, fileId, data);
            ObjectNode node = objectMapper.createObjectNode();
            node.put("type", "FILE");
            node.put("fileId", fileId);
            node.set("data", tree);
            return objectMapper.writeValueAsString(node);
        } catch (IOException e) {
            log.warn("图片数据解析失败: fileId={}", fileId);
            return null;
        }
    }

    public void sendRoomNotFoundToUser(String sessionId) {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(300L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            log.warn("房间不存在，拒绝进入: sessionId={}", sessionId);
            sendToSession(sessionId, Map.of("type", "ROOM_NOT_FOUND"));
        });
    }

    public void sendRoomFullToUser(String sessionId, int maxSessions) {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(300L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            log.warn("房间人数已满，拒绝进入: sessionId={}, max={}", sessionId, maxSessions);
            sendToSession(sessionId,
                    Map.of("type", "ROOM_FULL", "maxSessions", maxSessions));
        });
    }

    public void sendInitToUser(String sessionId, String roomId) {
        if (!roomService.isRoomActive(roomId)) {
            return;
        }
        Map<Object, Object> elements = roomService.getAllElements(roomId);
        Map<Object, Object> files = roomService.getAllFiles(roomId);
        ObjectNode wrapper = objectMapper.createObjectNode();
        wrapper.put("type", "INIT");
        ObjectNode elementsNode = wrapper.putObject("elements");
        elements.forEach((k, v) -> {
            try {
                elementsNode.set(k.toString(), objectMapper.readTree(v.toString()));
            } catch (IOException e) {
                log.warn("INIT 解析图元失败: elementId={}", k);
            }
        });
        ObjectNode filesNode = wrapper.putObject("files");
        files.forEach((k, v) -> {
            try {
                filesNode.set(k.toString(), objectMapper.readTree(v.toString()));
            } catch (IOException e) {
                log.warn("INIT 解析图片失败: fileId={}", k);
            }
        });
        screenShareService.getSharer(roomId).ifPresent(s -> {
            ObjectNode screen = wrapper.putObject("screenShare");
            screen.put("peerId", s.peerId());
            screen.put("name", s.name());
        });
        String currentPageId = roomService.getCurrentPageId(roomId);
        if (currentPageId != null && !currentPageId.isBlank()) {
            wrapper.put("currentPageId", currentPageId);
        }
        String createdAt = roomService.getCreatedAt(roomId);
        if (createdAt != null && !createdAt.isBlank()) {
            wrapper.put("createdAt", createdAt);
        }
        var expiresAt = roomService.resolveExpiresAt(roomId);
        if (expiresAt != null) {
            wrapper.put("expiresAt", expiresAt.toString());
        }
        ObjectNode kit = kitService.snapshot(roomId);
        if (!kit.isEmpty()) {
            wrapper.set("kit", kit);
        }
        var cams = cameraShareService.list(roomId);
        if (!cams.isEmpty()) {
            var arr = wrapper.putArray("cameraShare");
            for (CameraShareService.Publisher p : cams) {
                ObjectNode cam = arr.addObject();
                cam.put("peerId", p.peerId());
                cam.put("name", p.name());
            }
        }
        log.info("发送 INIT: sessionId={}, roomId={}, 元素数={}, 图片数={}",
                sessionId, roomId, elements.size(), files.size());
        sendToSession(sessionId, wrapper);
    }

    public void sendScreenBusyToUser(String sessionId, String sharerName) {
        sendToSession(sessionId,
                Map.of("type", "SCREEN_BUSY", "sharerName", sharerName == null ? "" : sharerName));
    }

    public void sendCameraBusyToUser(String sessionId, int maxCameras, List<String> names) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("type", "CAMERA_BUSY");
        body.put("maxCameras", maxCameras);
        body.put("names", names == null ? List.of() : names);
        sendToSession(sessionId, body);
    }

    public void sendCameraStateToUser(String sessionId, String roomId) {
        var cams = cameraShareService.list(roomId);
        ObjectNode wrapper = objectMapper.createObjectNode();
        wrapper.put("type", "CAMERA_STATE");
        var arr = wrapper.putArray("cameras");
        for (CameraShareService.Publisher p : cams) {
            ObjectNode cam = arr.addObject();
            cam.put("peerId", p.peerId());
            cam.put("name", p.name());
        }
        sendToSession(sessionId, wrapper);
    }

    private String buildElementMessage(String type, String elementId, String data) {
        try {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("type", type);
            node.put("elementId", elementId);
            node.set("data", objectMapper.readTree(data));
            return objectMapper.writeValueAsString(node);
        } catch (IOException e) {
            log.warn("构建广播消息失败: elementId={}", elementId);
            return null;
        }
    }

    private String buildDeleteMessage(String elementId) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", "DELETE");
        node.put("elementId", elementId);
        return node.toString();
    }
}
