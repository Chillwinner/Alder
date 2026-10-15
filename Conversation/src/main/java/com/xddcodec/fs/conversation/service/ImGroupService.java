/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.conversation.domain.ImConversation;
import com.xddcodec.fs.conversation.domain.ImGroup;
import com.xddcodec.fs.conversation.domain.ImGroupMember;
import com.xddcodec.fs.conversation.domain.dto.CreateGroupCmd;
import com.xddcodec.fs.conversation.domain.dto.InviteGroupMembersCmd;
import com.xddcodec.fs.conversation.domain.dto.UpdateGroupCmd;
import com.xddcodec.fs.conversation.domain.vo.ImGroupMemberVO;
import com.xddcodec.fs.conversation.domain.vo.ImGroupVO;
import com.xddcodec.fs.conversation.mapper.ImConversationMapper;
import com.xddcodec.fs.conversation.mapper.ImGroupMapper;
import com.xddcodec.fs.conversation.mapper.ImGroupMemberMapper;
import com.xddcodec.fs.conversation.mapper.ImUserInboxMapper;
import com.xddcodec.fs.conversation.support.ImConstants;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ImGroupService {

    private final ImGroupMapper imGroupMapper;
    private final ImGroupMemberMapper imGroupMemberMapper;
    private final ImConversationMapper imConversationMapper;
    private final ImUserInboxMapper imUserInboxMapper;
    private final SysUserMapper sysUserMapper;
    private final ImFriendService imFriendService;

    public List<ImGroupVO> listMyGroups(String userId) {
        return imGroupMapper.listByUserId(userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public ImGroupVO createGroup(String userId, CreateGroupCmd cmd) {
        String groupId = IdUtil.fastSimpleUUID();
        ImGroup group = new ImGroup();
        group.setId(groupId);
        group.setName(cmd.getName().trim());
        group.setAvatar(StringUtils.trimToNull(cmd.getAvatar()));
        group.setOwnerId(userId);
        group.setNotice(StringUtils.trimToNull(cmd.getNotice()));
        group.setMaxMembers(500);
        imGroupMapper.insert(group);

        Set<String> memberIds = new LinkedHashSet<>();
        memberIds.add(userId);
        if (cmd.getMemberIds() != null) {
            for (String memberId : cmd.getMemberIds()) {
                if (StringUtils.isNotBlank(memberId) && sysUserMapper.selectById(memberId) != null) {
                    memberIds.add(memberId);
                }
            }
        }
        for (String memberId : memberIds) {
            ImGroupMember member = new ImGroupMember();
            member.setGroupId(groupId);
            member.setUserId(memberId);
            member.setRole(userId.equals(memberId) ? ImConstants.ROLE_OWNER : ImConstants.ROLE_MEMBER);
            imGroupMemberMapper.insert(member);
        }

        ImConversation conversation = new ImConversation();
        conversation.setId(IdUtil.fastSimpleUUID());
        conversation.setConvType(ImConstants.CONV_GROUP);
        conversation.setGroupId(groupId);
        imConversationMapper.insert(conversation);

        for (String memberId : memberIds) {
            imUserInboxMapper.ensureInbox(memberId, conversation.getId());
        }

        ImGroupVO vo = new ImGroupVO();
        vo.setId(groupId);
        vo.setName(group.getName());
        vo.setAvatar(group.getAvatar());
        vo.setOwnerId(userId);
        vo.setNotice(group.getNotice());
        vo.setConversationId(conversation.getId());
        vo.setMemberCount(memberIds.size());
        vo.setCreatedAt(group.getCreatedAt());
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public ImGroupVO updateGroup(String userId, UpdateGroupCmd cmd) {
        String groupId = cmd.getGroupId();
        assertMember(groupId, userId);
        ImGroup group = imGroupMapper.selectById(groupId);
        if (group == null || group.getDissolvedAt() != null) {
            throw new BusinessException("im.group.not.exist");
        }
        String avatar = cmd.getAvatar() != null ? StringUtils.trimToNull(cmd.getAvatar()) : group.getAvatar();
        String notice = cmd.getNotice() != null ? StringUtils.trimToNull(cmd.getNotice()) : group.getNotice();
        imGroupMapper.updateProfile(groupId, avatar, notice);
        group.setAvatar(avatar);
        group.setNotice(notice);
        return toGroupVo(group);
    }

    public void assertMember(String groupId, String userId) {
        ImGroup group = imGroupMapper.selectById(groupId);
        if (group == null || group.getDissolvedAt() != null) {
            throw new BusinessException("im.group.not.exist");
        }
        if (imGroupMemberMapper.selectMember(groupId, userId) == null) {
            throw new BusinessException("im.group.not.member");
        }
    }

    public List<String> memberUserIds(String groupId) {
        return new ArrayList<>(imGroupMemberMapper.listUserIds(groupId));
    }

    public ImConversation requireGroupConversation(String groupId) {
        ImConversation conversation = imConversationMapper.selectByGroupId(groupId);
        if (conversation == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        return conversation;
    }

    public List<ImGroupMemberVO> listMembers(String userId, String groupId) {
        assertMember(groupId, userId);
        return imGroupMemberMapper.listMembers(groupId, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void leaveGroup(String userId, String groupId) {
        assertMember(groupId, userId);
        ImGroup group = imGroupMapper.selectById(groupId);
        if (group == null || group.getDissolvedAt() != null) {
            throw new BusinessException("im.group.not.exist");
        }
        ImConversation conversation = requireGroupConversation(groupId);
        ImGroupMember member = imGroupMemberMapper.selectMember(groupId, userId);
        int memberCount = imGroupMemberMapper.countByGroupId(groupId);

        if (ImConstants.ROLE_OWNER.equals(member.getRole()) && memberCount > 1) {
            List<ImGroupMember> members = imGroupMemberMapper.listByGroupId(groupId);
            String newOwnerId = null;
            for (ImGroupMember row : members) {
                if (!userId.equals(row.getUserId())) {
                    newOwnerId = row.getUserId();
                    break;
                }
            }
            if (newOwnerId == null) {
                throw new BusinessException("im.group.not.exist");
            }
            imGroupMemberMapper.updateRole(groupId, newOwnerId, ImConstants.ROLE_OWNER);
            imGroupMapper.updateOwner(groupId, newOwnerId);
        }

        imGroupMemberMapper.deleteMember(groupId, userId);
        imUserInboxMapper.deleteInbox(userId, conversation.getId());

        if (memberCount <= 1) {
            imGroupMapper.dissolve(groupId);
            imUserInboxMapper.deleteByConversation(conversation.getId());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public int inviteMembers(String userId, InviteGroupMembersCmd cmd) {
        String groupId = cmd.getGroupId();
        assertMember(groupId, userId);
        ImGroup group = imGroupMapper.selectById(groupId);
        if (group == null || group.getDissolvedAt() != null) {
            throw new BusinessException("im.group.not.exist");
        }
        ImConversation conversation = requireGroupConversation(groupId);
        if (cmd.getMemberIds() == null || cmd.getMemberIds().isEmpty()) {
            throw new BusinessException("im.group.invite.empty");
        }

        int currentCount = imGroupMemberMapper.countByGroupId(groupId);
        Set<String> toAdd = new LinkedHashSet<>();
        for (String memberId : cmd.getMemberIds()) {
            if (StringUtils.isBlank(memberId) || userId.equals(memberId)) {
                continue;
            }
            if (imGroupMemberMapper.selectMember(groupId, memberId) != null) {
                continue;
            }
            if (sysUserMapper.selectById(memberId) == null) {
                continue;
            }
            imFriendService.assertCanMessage(userId, memberId);
            toAdd.add(memberId);
        }
        if (toAdd.isEmpty()) {
            throw new BusinessException("im.group.invite.empty");
        }
        int maxMembers = group.getMaxMembers() == null ? 500 : group.getMaxMembers();
        if (currentCount + toAdd.size() > maxMembers) {
            throw new BusinessException("im.group.member.full");
        }

        for (String memberId : toAdd) {
            ImGroupMember member = new ImGroupMember();
            member.setGroupId(groupId);
            member.setUserId(memberId);
            member.setRole(ImConstants.ROLE_MEMBER);
            imGroupMemberMapper.insert(member);
            imUserInboxMapper.ensureInbox(memberId, conversation.getId());
        }
        return toAdd.size();
    }

    private ImGroupVO toGroupVo(ImGroup group) {
        ImConversation conversation = imConversationMapper.selectByGroupId(group.getId());
        ImGroupVO vo = new ImGroupVO();
        vo.setId(group.getId());
        vo.setName(group.getName());
        vo.setAvatar(group.getAvatar());
        vo.setOwnerId(group.getOwnerId());
        vo.setNotice(group.getNotice());
        vo.setConversationId(conversation != null ? conversation.getId() : null);
        vo.setMemberCount(imGroupMemberMapper.countByGroupId(group.getId()));
        vo.setCreatedAt(group.getCreatedAt());
        return vo;
    }
}
