/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.service;

import cn.hutool.core.util.IdUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.conversation.domain.ImFriend;
import com.xddcodec.fs.conversation.mapper.ImFriendMapper;
import com.xddcodec.fs.conversation.support.ImConstants;
import com.xddcodec.fs.lan.domain.LanTransferSession;
import com.xddcodec.fs.lan.domain.dto.CreateLanSessionCmd;
import com.xddcodec.fs.lan.domain.dto.LanFileItem;
import com.xddcodec.fs.lan.domain.dto.LanSignalCmd;
import com.xddcodec.fs.lan.domain.vo.LanEventVO;
import com.xddcodec.fs.lan.domain.vo.LanSessionVO;
import com.xddcodec.fs.lan.mapper.LanTransferSessionMapper;
import com.xddcodec.fs.lan.support.LanConstants;
import com.xddcodec.fs.sse.SseConnectionManager;
import com.xddcodec.fs.Sse.SseEventType;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class LanTransferService {

    private final LanTransferSessionMapper sessionMapper;
    private final ImFriendMapper friendMapper;
    private final SysUserMapper userMapper;
    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messaging;
    private final ObjectMapper objectMapper;
    private final SseConnectionManager sseConnectionManager;

    public void heartbeat(String userId) {
        redis.opsForValue().set(
                LanConstants.PRESENCE_KEY + userId,
                "1",
                Duration.ofSeconds(LanConstants.PRESENCE_TTL_SECONDS)
        );
    }

    public void onSseConnected(String userId) {
        heartbeat(userId);
        pushPresence(userId, true);
    }

    public void onSseDisconnected(String userId) {
        redis.delete(LanConstants.PRESENCE_KEY + userId);
        pushPresence(userId, false);
    }

    private void pushPresence(String userId, boolean online) {
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        data.put("online", online);
        for (var friend : friendMapper.listFriends(userId, ImConstants.FRIEND_ACCEPTED)) {
            if (friend == null || StringUtils.isBlank(friend.getFriendId())) {
                continue;
            }
            sseConnectionManager.sendEvent(friend.getFriendId(), SseEventType.LAN_PRESENCE.getValue(), data);
        }
    }

    public Map<String, Boolean> onlineMap(List<String> userIds) {
        Map<String, Boolean> map = new HashMap<>();
        if (userIds == null) {
            return map;
        }
        for (String userId : userIds) {
            if (StringUtils.isBlank(userId)) {
                continue;
            }
            map.put(userId, isOnline(userId));
        }
        return map;
    }

    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(redis.hasKey(LanConstants.PRESENCE_KEY + userId));
    }

    @Transactional(rollbackFor = Exception.class)
    public LanSessionVO create(String fromUserId, CreateLanSessionCmd cmd) {
        if (cmd == null || StringUtils.isBlank(cmd.getToUserId())) {
            throw new BusinessException("lan.peer.required");
        }
        String toUserId = cmd.getToUserId().trim();
        if (fromUserId.equals(toUserId)) {
            throw new BusinessException("lan.peer.self");
        }
        assertNotBlocked(fromUserId, toUserId);
        if (!isOnline(toUserId)) {
            throw new BusinessException("lan.peer.offline");
        }
        List<LanFileItem> files = normalizeFiles(cmd.getFiles());
        LanTransferSession row = new LanTransferSession();
        row.setId(IdUtil.fastSimpleUUID());
        row.setFromUserId(fromUserId);
        row.setToUserId(toUserId);
        try {
            row.setFilesJson(objectMapper.writeValueAsString(files));
        } catch (Exception e) {
            throw new BusinessException("lan.files.invalid");
        }
        row.setStatus(LanConstants.STATUS_PENDING);
        sessionMapper.insert(row);
        LanSessionVO vo = toVo(row);
        push(toUserId, LanConstants.EVENT_INVITE, vo, null, null);
        return vo;
    }

    public LanSessionVO get(String userId, String sessionId) {
        return toVo(requireParty(userId, sessionId));
    }

    @Transactional(rollbackFor = Exception.class)
    public LanSessionVO accept(String userId, String sessionId) {
        LanTransferSession row = requireParty(userId, sessionId);
        if (!userId.equals(row.getToUserId())) {
            throw new BusinessException("lan.session.forbidden");
        }
        if (!LanConstants.STATUS_PENDING.equals(row.getStatus())) {
            throw new BusinessException("lan.session.closed");
        }
        sessionMapper.updateStatus(sessionId, LanConstants.STATUS_ACCEPTED);
        row.setStatus(LanConstants.STATUS_ACCEPTED);
        LanSessionVO vo = toVo(row);
        push(row.getFromUserId(), LanConstants.EVENT_ACCEPTED, vo, null, null);
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public void reject(String userId, String sessionId) {
        closeByTo(userId, sessionId, LanConstants.STATUS_REJECTED, LanConstants.EVENT_REJECTED);
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancel(String userId, String sessionId) {
        LanTransferSession row = requireParty(userId, sessionId);
        if (!Set.of(LanConstants.STATUS_PENDING, LanConstants.STATUS_ACCEPTED).contains(row.getStatus())) {
            return;
        }
        sessionMapper.updateStatus(sessionId, LanConstants.STATUS_CANCELLED);
        row.setStatus(LanConstants.STATUS_CANCELLED);
        String other = userId.equals(row.getFromUserId()) ? row.getToUserId() : row.getFromUserId();
        push(other, LanConstants.EVENT_CANCELLED, toVo(row), null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void fail(String userId, String sessionId) {
        LanTransferSession row = requireParty(userId, sessionId);
        if (!Set.of(LanConstants.STATUS_PENDING, LanConstants.STATUS_ACCEPTED).contains(row.getStatus())) {
            return;
        }
        sessionMapper.updateStatus(sessionId, LanConstants.STATUS_FAILED);
        row.setStatus(LanConstants.STATUS_FAILED);
        String other = userId.equals(row.getFromUserId()) ? row.getToUserId() : row.getFromUserId();
        push(other, LanConstants.EVENT_FAILED, toVo(row), null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void done(String userId, String sessionId) {
        LanTransferSession row = requireParty(userId, sessionId);
        sessionMapper.updateStatus(sessionId, LanConstants.STATUS_DONE);
        row.setStatus(LanConstants.STATUS_DONE);
        String other = userId.equals(row.getFromUserId()) ? row.getToUserId() : row.getFromUserId();
        push(other, LanConstants.EVENT_DONE, toVo(row), null, null);
    }

    public void signal(String userId, String sessionId, LanSignalCmd cmd) {
        LanTransferSession row = requireParty(userId, sessionId);
        if (!LanConstants.STATUS_ACCEPTED.equals(row.getStatus())) {
            throw new BusinessException("lan.session.not.accepted");
        }
        if (cmd == null || StringUtils.isBlank(cmd.getType())) {
            throw new BusinessException("lan.signal.invalid");
        }
        String other = userId.equals(row.getFromUserId()) ? row.getToUserId() : row.getFromUserId();
        push(other, LanConstants.EVENT_SIGNAL, toVo(row), cmd.getType(), cmd.getPayload());
    }

    private void closeByTo(String userId, String sessionId, String status, String event) {
        LanTransferSession row = requireParty(userId, sessionId);
        if (!userId.equals(row.getToUserId())) {
            throw new BusinessException("lan.session.forbidden");
        }
        if (!LanConstants.STATUS_PENDING.equals(row.getStatus())) {
            throw new BusinessException("lan.session.closed");
        }
        sessionMapper.updateStatus(sessionId, status);
        row.setStatus(status);
        push(row.getFromUserId(), event, toVo(row), null, null);
    }

    private void assertNotBlocked(String userId, String friendId) {
        ImFriend mine = friendMapper.selectPair(userId, friendId);
        ImFriend theirs = friendMapper.selectPair(friendId, userId);
        if (mine != null && ImConstants.FRIEND_BLOCKED.equals(mine.getStatus())) {
            throw new BusinessException("im.friend.blocked");
        }
        if (theirs != null && ImConstants.FRIEND_BLOCKED.equals(theirs.getStatus())) {
            throw new BusinessException("im.friend.blocked.by.peer");
        }
    }

    private List<LanFileItem> normalizeFiles(List<LanFileItem> files) {
        if (files == null || files.isEmpty()) {
            throw new BusinessException("lan.files.required");
        }
        if (files.size() > LanConstants.MAX_FILES) {
            throw new BusinessException("lan.files.too.many");
        }
        List<LanFileItem> out = new ArrayList<>();
        for (LanFileItem item : files) {
            if (item == null || StringUtils.isBlank(item.getName()) || item.getSize() < 0) {
                throw new BusinessException("lan.files.invalid");
            }
            LanFileItem copy = new LanFileItem();
            copy.setName(item.getName().trim());
            copy.setRelativePath(StringUtils.defaultIfBlank(item.getRelativePath(), item.getName()).trim());
            copy.setSize(item.getSize());
            out.add(copy);
        }
        return out;
    }

    private LanTransferSession requireParty(String userId, String sessionId) {
        LanTransferSession row = sessionMapper.selectById(sessionId);
        if (row == null) {
            throw new BusinessException("lan.session.not.found");
        }
        if (!userId.equals(row.getFromUserId()) && !userId.equals(row.getToUserId())) {
            throw new BusinessException("lan.session.forbidden");
        }
        return row;
    }

    private LanSessionVO toVo(LanTransferSession row) {
        LanSessionVO vo = new LanSessionVO();
        vo.setId(row.getId());
        vo.setFromUserId(row.getFromUserId());
        vo.setToUserId(row.getToUserId());
        vo.setFromName(displayName(row.getFromUserId()));
        vo.setToName(displayName(row.getToUserId()));
        vo.setStatus(row.getStatus());
        vo.setCreatedAt(row.getCreatedAt());
        try {
            vo.setFiles(objectMapper.readValue(row.getFilesJson(), new TypeReference<>() {
            }));
        } catch (Exception e) {
            vo.setFiles(List.of());
        }
        return vo;
    }

    private String displayName(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            return userId;
        }
        return StringUtils.defaultIfBlank(user.getNickname(), user.getUsername());
    }

    private void push(String userId, String type, LanSessionVO session, String signalType, String payload) {
        LanEventVO event = new LanEventVO();
        event.setType(type);
        event.setSessionId(session.getId());
        event.setFromUserId(session.getFromUserId());
        event.setSession(session);
        event.setSignalType(signalType);
        event.setPayload(payload);
        messaging.convertAndSendToUser(ImConstants.userPrincipal(userId), "/queue/lan", event);
    }
}
