/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.conversation.domain.ImConversation;
import com.xddcodec.fs.conversation.domain.ImMessage;
import com.xddcodec.fs.conversation.domain.ImUserInbox;
import com.xddcodec.fs.conversation.domain.dto.ImPush;
import com.xddcodec.fs.conversation.domain.dto.ImReadCmd;
import com.xddcodec.fs.conversation.domain.dto.ImMessageIdCmd;
import com.xddcodec.fs.conversation.domain.dto.ImMuteCmd;
import com.xddcodec.fs.conversation.domain.dto.ImSendCmd;
import com.xddcodec.fs.conversation.domain.vo.ImFriendVO;
import com.xddcodec.fs.conversation.domain.vo.ImGroupVO;
import com.xddcodec.fs.conversation.domain.vo.ImHistoryVO;
import com.xddcodec.fs.conversation.domain.vo.ImInboxVO;
import com.xddcodec.fs.conversation.domain.vo.ImMessageVO;
import com.xddcodec.fs.conversation.mapper.ImConversationMapper;
import com.xddcodec.fs.conversation.mapper.ImMessageMapper;
import com.xddcodec.fs.conversation.mapper.ImUserInboxMapper;
import com.xddcodec.fs.conversation.domain.dto.ImMessageMediaPayload;
import com.xddcodec.fs.conversation.support.ImConstants;
import com.xddcodec.fs.conversation.support.ImMessageContentHelper;
import com.xddcodec.fs.common.utils.JsonUtils;
import com.xddcodec.fs.file.service.FileShareService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final int HISTORY_LIMIT = 100;

    private final ImConversationMapper imConversationMapper;
    private final ImMessageMapper imMessageMapper;
    private final ImUserInboxMapper imUserInboxMapper;
    private final ImFriendService imFriendService;
    private final ImGroupService imGroupService;
    private final ImPushService imPushService;
    private final FileShareService fileShareService;

    @Value("${spring.application.name:free-fs}")
    private String applicationName;

    @Value("${fs.chat-save-path:/Chat}")
    private String chatSavePath;

    public List<ImInboxVO> inbox(String userId) {
        List<ImInboxVO> items = new ArrayList<>(imUserInboxMapper.listInbox(userId));
        Set<String> coveredPeers = new HashSet<>();
        Set<String> coveredGroupIds = new HashSet<>();
        for (ImInboxVO item : items) {
            if (ImConstants.CONV_SINGLE.equals(item.getConvType())
                    && StringUtils.isNotBlank(item.getPeerUserId())) {
                coveredPeers.add(item.getPeerUserId());
            }
            if (ImConstants.CONV_GROUP.equals(item.getConvType())
                    && StringUtils.isNotBlank(item.getGroupId())) {
                coveredGroupIds.add(item.getGroupId());
            }
        }

        for (ImFriendVO friend : imFriendService.listFriends(userId)) {
            if (coveredPeers.contains(friend.getFriendId())) {
                continue;
            }
            ImInboxVO row = new ImInboxVO();
            row.setConvType(ImConstants.CONV_SINGLE);
            row.setPeerUserId(friend.getFriendId());
            row.setPeerUsername(friend.getUsername());
            row.setPeerNickname(friend.getNickname());
            row.setPeerAvatar(friend.getAvatar());
            row.setUnreadCount(0);
            String userAId = userId.compareTo(friend.getFriendId()) <= 0 ? userId : friend.getFriendId();
            String userBId = userId.compareTo(friend.getFriendId()) <= 0 ? friend.getFriendId() : userId;
            ImConversation conversation = imConversationMapper.selectSingle(userAId, userBId);
            if (conversation != null) {
                row.setConversationId(conversation.getId());
            }
            items.add(row);
        }

        for (ImGroupVO group : imGroupService.listMyGroups(userId)) {
            if (coveredGroupIds.contains(group.getId())) {
                continue;
            }
            ImInboxVO row = new ImInboxVO();
            row.setConvType(ImConstants.CONV_GROUP);
            row.setGroupId(group.getId());
            row.setGroupName(group.getName());
            row.setGroupAvatar(group.getAvatar());
            row.setConversationId(group.getConversationId());
            row.setUnreadCount(0);
            items.add(row);
        }

        items.sort((left, right) -> {
            boolean leftPinned = Boolean.TRUE.equals(left.getPinned());
            boolean rightPinned = Boolean.TRUE.equals(right.getPinned());
            if (leftPinned != rightPinned) {
                return leftPinned ? -1 : 1;
            }
            if (left.getLastTime() != null && right.getLastTime() != null) {
                return right.getLastTime().compareTo(left.getLastTime());
            }
            if (left.getLastTime() != null) {
                return -1;
            }
            if (right.getLastTime() != null) {
                return 1;
            }
            return inboxTitle(left).compareToIgnoreCase(inboxTitle(right));
        });
        return items;
    }

    private String inboxTitle(ImInboxVO item) {
        if (ImConstants.CONV_GROUP.equals(item.getConvType())) {
            return StringUtils.defaultString(item.getGroupName(), item.getConversationId());
        }
        if (StringUtils.isNotBlank(item.getPeerNickname())) {
            return item.getPeerNickname();
        }
        if (StringUtils.isNotBlank(item.getPeerUsername())) {
            return item.getPeerUsername();
        }
        return StringUtils.defaultString(item.getPeerUserId(), "");
    }

    public int unreadTotal(String userId) {
        Integer total = imUserInboxMapper.sumUnread(userId);
        return total == null ? 0 : total;
    }

    public ImHistoryVO history(String userId, String conversationId, Long afterId, Long beforeId, Integer limit) {
        ImConversation conversation = requireConversation(conversationId);
        assertParticipant(userId, conversation);
        int size = limit == null || limit <= 0 ? 50 : Math.min(limit, HISTORY_LIMIT);
        long after = afterId == null ? 0L : afterId;
        long before = beforeId == null ? 0L : beforeId;
        ImHistoryVO result = new ImHistoryVO();
        if (before > 0) {
            List<ImMessageVO> older = imMessageMapper.listBeforeVo(conversationId, userId, before, size);
            Collections.reverse(older);
            result.setMessages(older);
        } else if (after <= 0) {
            List<ImMessageVO> latest = imMessageMapper.listLatestVo(conversationId, userId, size);
            Collections.reverse(latest);
            result.setMessages(latest);
        } else {
            result.setMessages(imMessageMapper.listAfterVo(conversationId, userId, after, size));
        }
        if (ImConstants.CONV_SINGLE.equals(conversation.getConvType())) {
            String peerId = userId.equals(conversation.getUserAId())
                    ? conversation.getUserBId()
                    : conversation.getUserAId();
            Long peerLastRead = imUserInboxMapper.selectLastReadMessageId(peerId, conversationId);
            result.setPeerLastReadMessageId(peerLastRead == null ? 0L : peerLastRead);
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public ImMessageVO send(String userId, ImSendCmd cmd) {
        String conversationId = StringUtils.trimToNull(cmd.getConversationId());
        ImConversation conversation;
        if (conversationId == null) {
            String friendId = StringUtils.trimToNull(cmd.getFriendId());
            if (friendId == null) {
                throw new BusinessException("im.conversation.target.required");
            }
            conversation = getOrCreateSingleConversation(userId, friendId);
            conversationId = conversation.getId();
        } else {
            conversation = requireConversation(conversationId);
            assertParticipant(userId, conversation);
        }

        String clientMsgId = cmd.getClientMsgId().trim();
        String msgType = ImMessageContentHelper.normalizeMsgType(cmd.getMsgType());
        ImMessageContentHelper.PreparedMessage prepared;
        if (ImConstants.MSG_ENCRYPTED_TEXT.equals(msgType)) {
            prepared = ImMessageContentHelper.prepareEncrypted(cmd.getContent());
        } else if (ImConstants.MSG_TEXT.equals(msgType)) {
            prepared = ImMessageContentHelper.prepareText(cmd.getContent());
        } else {
            ImMessageMediaPayload payload = JsonUtils.parseObject(cmd.getContent(), ImMessageMediaPayload.class);
            if (payload != null && StringUtils.isNotBlank(payload.getShareId())) {
                fileShareService.assertOwnedShareItem(userId, payload.getShareId(), payload.getFileId());
            }
            prepared = ImMessageContentHelper.prepareMedia(
                    cmd.getContent(), msgType, userId, applicationName, chatSavePath);
        }

        ImMessage existing = imMessageMapper.selectByClientMsg(conversationId, userId, clientMsgId);
        if (existing != null) {
            return requireMessageVo(existing.getId());
        }

        ImMessage row = new ImMessage();
        row.setClientMsgId(clientMsgId);
        row.setConversationId(conversationId);
        row.setSenderId(userId);
        row.setContent(prepared.content());
        row.setMsgType(prepared.msgType());
        row.setCreatedAt(LocalDateTime.now());
        row.setQuoteMessageId(resolveQuoteMessageId(conversationId, cmd.getQuoteMessageId()));
        String inboxPreview = prepared.inboxPreview();
        try {
            imMessageMapper.insert(row);
        } catch (DuplicateKeyException ignored) {
            ImMessage duplicated = imMessageMapper.selectByClientMsg(conversationId, userId, clientMsgId);
            return requireMessageVo(duplicated.getId());
        }

        updateSenderPreview(userId, conversationId, row, inboxPreview);
        List<String> recipients = resolveRecipients(conversation, userId);
        for (String recipientId : recipients) {
            if (recipientId.equals(userId)) {
                continue;
            }
            imUserInboxMapper.bumpUnread(recipientId, conversationId, row, inboxPreview);
            publishMessage(recipientId, conversationId, row.getId());
        }
        publishMessage(userId, conversationId, row.getId());
        return requireMessageVo(row.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public int markRead(String userId, ImReadCmd cmd) {
        ImConversation conversation = requireConversation(cmd.getConversationId());
        assertParticipant(userId, conversation);
        imUserInboxMapper.markRead(userId, cmd.getConversationId(), cmd.getLastId());
        ImUserInbox inbox = imUserInboxMapper.selectPair(userId, cmd.getConversationId());
        int unread = inbox == null || inbox.getUnreadCount() == null ? 0 : inbox.getUnreadCount();
        imPushService.publish(ImPush.builder()
                .type(ImConstants.PUSH_UNREAD)
                .userId(userId)
                .conversationId(cmd.getConversationId())
                .unreadCount(unread)
                .build());
        publishReadReceipt(conversation, userId, cmd.getConversationId(), cmd.getLastId());
        return unreadTotal(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void setMuted(String userId, ImMuteCmd cmd) {
        ImConversation conversation = requireConversation(cmd.getConversationId());
        assertParticipant(userId, conversation);
        imUserInboxMapper.ensureInbox(userId, cmd.getConversationId());
        imUserInboxMapper.updateMuted(userId, cmd.getConversationId(), Boolean.TRUE.equals(cmd.getMuted()));
    }

    @Transactional(rollbackFor = Exception.class)
    public ImMessageVO recall(String userId, ImMessageIdCmd cmd) {
        ImMessage message = imMessageMapper.selectById(cmd.getMessageId());
        if (message == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        ImConversation conversation = requireConversation(message.getConversationId());
        assertParticipant(userId, conversation);
        if (!userId.equals(message.getSenderId())) {
            throw new BusinessException("im.message.recall.forbidden");
        }
        if (message.getRecalledAt() != null) {
            throw new BusinessException("im.message.recall.already");
        }
        if (message.getCreatedAt() == null
                || message.getCreatedAt().plusSeconds(ImConstants.RECALL_LIMIT_SECONDS).isBefore(LocalDateTime.now())) {
            throw new BusinessException("im.message.recall.expired");
        }
        int updated = imMessageMapper.markRecalled(message.getId(), LocalDateTime.now());
        if (updated == 0) {
            throw new BusinessException("im.message.recall.already");
        }
        imUserInboxMapper.replacePreviewIfLastMessage(
                message.getConversationId(), message.getId(), ImConstants.RECALL_INBOX_PREVIEW);
        for (String recipientId : resolveRecipients(conversation, userId)) {
            publishRecall(recipientId, message.getConversationId(), message.getId());
        }
        publishRecall(userId, message.getConversationId(), message.getId());
        return requireMessageVo(message.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void hide(String userId, ImMessageIdCmd cmd) {
        ImMessage message = imMessageMapper.selectById(cmd.getMessageId());
        if (message == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        ImConversation conversation = requireConversation(message.getConversationId());
        assertParticipant(userId, conversation);
        imMessageMapper.hideForUser(userId, message.getId(), message.getConversationId());
        refreshInboxPreview(userId, message.getConversationId());
    }

    private void refreshInboxPreview(String userId, String conversationId) {
        ImMessageVO latest = imMessageMapper.selectLatestVisibleVo(conversationId, userId);
        imUserInboxMapper.ensureInbox(userId, conversationId);
        if (latest == null) {
            ImMessage empty = new ImMessage();
            empty.setId(0L);
            empty.setCreatedAt(LocalDateTime.now());
            imUserInboxMapper.touchPreview(userId, conversationId, empty, "");
            return;
        }
        ImMessage row = new ImMessage();
        row.setId(latest.getId());
        row.setCreatedAt(latest.getCreatedAt());
        imUserInboxMapper.touchPreview(userId, conversationId, row, ImMessageContentHelper.inboxPreview(latest));
    }

    public ImConversation getOrCreateSingleConversation(String userId, String friendId) {
        imFriendService.assertCanMessage(userId, friendId);
        String userAId = userId.compareTo(friendId) <= 0 ? userId : friendId;
        String userBId = userId.compareTo(friendId) <= 0 ? friendId : userId;
        ImConversation existing = imConversationMapper.selectSingle(userAId, userBId);
        if (existing != null) {
            imUserInboxMapper.ensureInbox(userId, existing.getId());
            imUserInboxMapper.ensureInbox(friendId, existing.getId());
            return existing;
        }
        ImConversation conversation = new ImConversation();
        conversation.setId(IdUtil.fastSimpleUUID());
        conversation.setConvType(ImConstants.CONV_SINGLE);
        conversation.setUserAId(userAId);
        conversation.setUserBId(userBId);
        imConversationMapper.insert(conversation);
        imUserInboxMapper.ensureInbox(userId, conversation.getId());
        imUserInboxMapper.ensureInbox(friendId, conversation.getId());
        return conversation;
    }

    private void updateSenderPreview(String userId, String conversationId, ImMessage row, String preview) {
        imUserInboxMapper.ensureInbox(userId, conversationId);
        imUserInboxMapper.touchPreview(userId, conversationId, row, preview);
    }

    private List<String> resolveRecipients(ImConversation conversation, String senderId) {
        if (ImConstants.CONV_GROUP.equals(conversation.getConvType())) {
            List<String> members = imGroupService.memberUserIds(conversation.getGroupId());
            return members.isEmpty() ? List.of(senderId) : members;
        }
        List<String> recipients = new ArrayList<>(2);
        if (!senderId.equals(conversation.getUserAId())) {
            recipients.add(conversation.getUserAId());
        }
        if (!senderId.equals(conversation.getUserBId())) {
            recipients.add(conversation.getUserBId());
        }
        return recipients;
    }

    private Long resolveQuoteMessageId(String conversationId, Long quoteMessageId) {
        if (quoteMessageId == null) {
            return null;
        }
        ImMessage quoted = imMessageMapper.selectById(quoteMessageId);
        if (quoted == null
                || !conversationId.equals(quoted.getConversationId())
                || quoted.getRecalledAt() != null) {
            throw new BusinessException("im.message.quote.invalid");
        }
        return quoted.getId();
    }

    private void publishRecall(String userId, String conversationId, Long messageId) {
        ImUserInbox inbox = imUserInboxMapper.selectPair(userId, conversationId);
        int unread = inbox == null || inbox.getUnreadCount() == null ? 0 : inbox.getUnreadCount();
        imPushService.publish(ImPush.builder()
                .type(ImConstants.PUSH_RECALL)
                .userId(userId)
                .conversationId(conversationId)
                .unreadCount(unread)
                .message(requireMessageVo(messageId))
                .build());
    }

    private void publishMessage(String userId, String conversationId, Long messageId) {
        ImUserInbox inbox = imUserInboxMapper.selectPair(userId, conversationId);
        int unread = inbox == null || inbox.getUnreadCount() == null ? 0 : inbox.getUnreadCount();
        ImMessageVO message = requireMessageVo(messageId);
        imPushService.publish(ImPush.builder()
                .type(ImConstants.PUSH_MESSAGE)
                .userId(userId)
                .conversationId(conversationId)
                .unreadCount(unread)
                .message(message)
                .build());
    }

    private void publishReadReceipt(ImConversation conversation, String readerId, String conversationId, long lastId) {
        if (!ImConstants.CONV_SINGLE.equals(conversation.getConvType())) {
            return;
        }
        String peerId = readerId.equals(conversation.getUserAId())
                ? conversation.getUserBId()
                : conversation.getUserAId();
        imPushService.publish(ImPush.builder()
                .type(ImConstants.PUSH_READ)
                .userId(peerId)
                .conversationId(conversationId)
                .lastReadMessageId(lastId)
                .build());
    }

    private ImMessageVO requireMessageVo(Long messageId) {
        ImMessageVO message = imMessageMapper.selectVoById(messageId);
        if (message == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        return message;
    }

    private ImConversation requireConversation(String conversationId) {
        ImConversation conversation = imConversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        return conversation;
    }

    private void assertParticipant(String userId, ImConversation conversation) {
        if (ImConstants.CONV_SINGLE.equals(conversation.getConvType())) {
            if (!userId.equals(conversation.getUserAId()) && !userId.equals(conversation.getUserBId())) {
                throw new BusinessException("im.conversation.forbidden");
            }
            return;
        }
        imGroupService.assertMember(conversation.getGroupId(), userId);
    }
}
