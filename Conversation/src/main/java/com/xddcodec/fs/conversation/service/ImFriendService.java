/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.conversation.domain.ImFriend;
import com.xddcodec.fs.conversation.domain.dto.ImFriendCmd;
import com.xddcodec.fs.conversation.domain.vo.ImFriendVO;
import com.xddcodec.fs.conversation.domain.vo.ImUserSearchVO;
import com.xddcodec.fs.conversation.domain.dto.ImPush;
import com.xddcodec.fs.conversation.mapper.ImFriendMapper;
import com.xddcodec.fs.conversation.mapper.ImUserSearchMapper;
import com.xddcodec.fs.conversation.support.ImConstants;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ImFriendService {

    private final ImFriendMapper imFriendMapper;
    private final ImUserSearchMapper imUserSearchMapper;
    private final SysUserMapper sysUserMapper;
    private final ImPushService imPushService;

    public List<ImFriendVO> listFriends(String userId) {
        return imFriendMapper.listFriends(userId, ImConstants.FRIEND_ACCEPTED);
    }

    public List<ImFriendVO> listIncomingRequests(String userId) {
        return imFriendMapper.listIncomingRequests(userId);
    }

    public List<ImFriendVO> listRejectedRequests(String userId) {
        return imFriendMapper.listRejectedRequests(userId);
    }

    public List<ImUserSearchVO> searchUsers(String userId, String keyword) {
        String normalized = StringUtils.trimToNull(keyword);
        if (normalized == null || normalized.length() < 2) {
            return Collections.emptyList();
        }
        return imUserSearchMapper.search(userId, normalized);
    }

    @Transactional(rollbackFor = Exception.class)
    public void requestFriend(String userId, ImFriendCmd cmd) {
        String friendId = cmd.getFriendId();
        if (userId.equals(friendId)) {
            throw new BusinessException("im.friend.self");
        }
        if (sysUserMapper.selectById(friendId) == null) {
            throw new BusinessException("im.user.not.exist");
        }
        ImFriend reverse = imFriendMapper.selectPair(friendId, userId);
        if (reverse != null && ImConstants.FRIEND_ACCEPTED.equals(reverse.getStatus())) {
            throw new BusinessException("im.friend.already");
        }
        ImFriend existing = imFriendMapper.selectPair(userId, friendId);
        if (existing != null) {
            if (ImConstants.FRIEND_BLOCKED.equals(existing.getStatus())) {
                throw new BusinessException("im.friend.blocked");
            }
            if (ImConstants.FRIEND_PENDING.equals(existing.getStatus())) {
                return;
            }
            if (ImConstants.FRIEND_ACCEPTED.equals(existing.getStatus())) {
                throw new BusinessException("im.friend.already");
            }
            if (ImConstants.FRIEND_REJECTED.equals(existing.getStatus())) {
                imFriendMapper.updateStatus(userId, friendId, ImConstants.FRIEND_PENDING);
                notifyFriendRequest(friendId);
                return;
            }
            throw new BusinessException("im.friend.already");
        }
        ImFriend row = new ImFriend();
        row.setUserId(userId);
        row.setFriendId(friendId);
        row.setStatus(ImConstants.FRIEND_PENDING);
        row.setRemark(StringUtils.trimToNull(cmd.getRemark()));
        imFriendMapper.insert(row);
        notifyFriendRequest(friendId);
    }

    private void notifyFriendRequest(String targetUserId) {
        imPushService.publish(ImPush.builder()
                .type(ImConstants.PUSH_FRIEND_REQUEST)
                .userId(targetUserId)
                .build());
    }

    @Transactional(rollbackFor = Exception.class)
    public void acceptFriend(String userId, String friendId) {
        ImFriend incoming = imFriendMapper.selectPair(friendId, userId);
        if (incoming == null
                || (!ImConstants.FRIEND_PENDING.equals(incoming.getStatus())
                && !ImConstants.FRIEND_REJECTED.equals(incoming.getStatus()))) {
            throw new BusinessException("im.friend.request.not.found");
        }
        imFriendMapper.updateStatus(friendId, userId, ImConstants.FRIEND_ACCEPTED);
        ImFriend reverse = imFriendMapper.selectPair(userId, friendId);
        if (reverse == null) {
            ImFriend row = new ImFriend();
            row.setUserId(userId);
            row.setFriendId(friendId);
            row.setStatus(ImConstants.FRIEND_ACCEPTED);
            row.setRemark(incoming.getRemark());
            imFriendMapper.insert(row);
        } else {
            imFriendMapper.updateStatus(userId, friendId, ImConstants.FRIEND_ACCEPTED);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void rejectFriend(String userId, String friendId) {
        ImFriend incoming = imFriendMapper.selectPair(friendId, userId);
        if (incoming == null || !ImConstants.FRIEND_PENDING.equals(incoming.getStatus())) {
            throw new BusinessException("im.friend.request.not.found");
        }
        imFriendMapper.updateStatus(friendId, userId, ImConstants.FRIEND_REJECTED);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteFriend(String userId, String friendId) {
        ImFriend mine = imFriendMapper.selectPair(userId, friendId);
        if (mine == null || !ImConstants.FRIEND_ACCEPTED.equals(mine.getStatus())) {
            throw new BusinessException("im.friend.not.found");
        }
        imFriendMapper.deletePair(userId, friendId);
        imFriendMapper.deletePair(friendId, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void blockFriend(String userId, String friendId) {
        ImFriend existing = imFriendMapper.selectPair(userId, friendId);
        if (existing == null) {
            ImFriend row = new ImFriend();
            row.setUserId(userId);
            row.setFriendId(friendId);
            row.setStatus(ImConstants.FRIEND_BLOCKED);
            imFriendMapper.insert(row);
            return;
        }
        imFriendMapper.updateStatus(userId, friendId, ImConstants.FRIEND_BLOCKED);
    }

    public void assertCanMessage(String userId, String friendId) {
        if (userId.equals(friendId)) {
            throw new BusinessException("im.friend.self");
        }
        ImFriend mine = imFriendMapper.selectPair(userId, friendId);
        ImFriend theirs = imFriendMapper.selectPair(friendId, userId);
        if (mine != null && ImConstants.FRIEND_BLOCKED.equals(mine.getStatus())) {
            throw new BusinessException("im.friend.blocked");
        }
        if (theirs != null && ImConstants.FRIEND_BLOCKED.equals(theirs.getStatus())) {
            throw new BusinessException("im.friend.blocked.by.peer");
        }
        boolean accepted = mine != null && ImConstants.FRIEND_ACCEPTED.equals(mine.getStatus())
                && theirs != null && ImConstants.FRIEND_ACCEPTED.equals(theirs.getStatus());
        if (!accepted) {
            throw new BusinessException("im.friend.not.accepted");
        }
    }
}
