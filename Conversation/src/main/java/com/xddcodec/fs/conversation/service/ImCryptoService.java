/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.conversation.domain.ImGroupKeyWrap;
import com.xddcodec.fs.conversation.domain.ImUserCrypto;
import com.xddcodec.fs.conversation.domain.dto.ImCryptoRegisterCmd;
import com.xddcodec.fs.conversation.domain.dto.ImGroupKeyWrapCmd;
import com.xddcodec.fs.conversation.domain.vo.ImCryptoMeVO;
import com.xddcodec.fs.conversation.domain.vo.ImGroupKeyWrapVO;
import com.xddcodec.fs.conversation.mapper.ImGroupKeyWrapMapper;
import com.xddcodec.fs.conversation.mapper.ImGroupMemberMapper;
import com.xddcodec.fs.conversation.mapper.ImUserCryptoMapper;
import com.xddcodec.fs.conversation.support.ImConstants;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ImCryptoService {

    private static final int MAX_KEY_LENGTH = 8192;
    private static final int MAX_PROOF_LENGTH = 8192;
    private static final int MAX_WRAP_LENGTH = 8192;

    private final ImUserCryptoMapper userCryptoMapper;
    private final ImGroupKeyWrapMapper groupKeyWrapMapper;
    private final ImGroupMemberMapper groupMemberMapper;

    public ImCryptoMeVO me(String userId) {
        ImUserCrypto row = userCryptoMapper.selectByUserId(userId);
        ImCryptoMeVO vo = new ImCryptoMeVO();
        if (row == null) {
            vo.setRegistered(false);
            return vo;
        }
        vo.setRegistered(true);
        vo.setPublicKeySpki(row.getPublicKeySpki());
        vo.setKeyProof(row.getKeyProof());
        return vo;
    }

    public String publicKeyOf(String userId) {
        ImUserCrypto row = userCryptoMapper.selectByUserId(userId);
        if (row == null || StringUtils.isBlank(row.getPublicKeySpki())) {
            throw new BusinessException("im.crypto.user.not.registered");
        }
        return row.getPublicKeySpki();
    }

    @Transactional(rollbackFor = Exception.class)
    public void register(String userId, ImCryptoRegisterCmd cmd) {
        String publicKey = StringUtils.trimToNull(cmd == null ? null : cmd.getPublicKeySpki());
        String keyProof = StringUtils.trimToNull(cmd == null ? null : cmd.getKeyProof());
        if (publicKey == null || publicKey.length() > MAX_KEY_LENGTH) {
            throw new BusinessException("im.crypto.public.invalid");
        }
        if (keyProof == null || keyProof.length() > MAX_PROOF_LENGTH) {
            throw new BusinessException("im.crypto.proof.invalid");
        }
        ImUserCrypto row = new ImUserCrypto();
        row.setUserId(userId);
        row.setPublicKeySpki(publicKey);
        row.setKeyProof(keyProof);
        userCryptoMapper.upsert(row);
    }

    public ImGroupKeyWrapVO myGroupWrap(String userId, String groupId) {
        assertGroupMember(userId, groupId);
        ImGroupKeyWrap row = groupKeyWrapMapper.selectForMember(groupId, userId);
        if (row == null) {
            return null;
        }
        ImGroupKeyWrapVO vo = new ImGroupKeyWrapVO();
        vo.setGroupId(groupId);
        vo.setKeyVersion(row.getKeyVersion());
        vo.setWrappedKey(row.getWrappedKey());
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public void publishGroupWraps(String userId, String groupId, ImGroupKeyWrapCmd cmd) {
        assertGroupAdminOrOwner(userId, groupId);
        if (cmd == null || cmd.getWraps() == null || cmd.getWraps().isEmpty()) {
            throw new BusinessException("im.crypto.group.wrap.required");
        }
        int version = cmd.getKeyVersion() == null || cmd.getKeyVersion() < 1 ? 1 : cmd.getKeyVersion();
        Set<String> members = memberIds(groupId);
        Set<String> seen = new HashSet<>();
        for (ImGroupKeyWrapCmd.MemberWrap wrap : cmd.getWraps()) {
            String targetId = StringUtils.trimToNull(wrap.getUserId());
            String payload = StringUtils.trimToNull(wrap.getWrappedKey());
            if (targetId == null || payload == null || payload.length() > MAX_WRAP_LENGTH) {
                throw new BusinessException("im.crypto.group.wrap.invalid");
            }
            if (!members.contains(targetId)) {
                throw new BusinessException("im.crypto.group.wrap.invalid");
            }
            if (!seen.add(targetId)) {
                throw new BusinessException("im.crypto.group.wrap.invalid");
            }
            ImGroupKeyWrap row = new ImGroupKeyWrap();
            row.setGroupId(groupId);
            row.setUserId(targetId);
            row.setKeyVersion(version);
            row.setWrappedKey(payload);
            groupKeyWrapMapper.upsert(row);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void rotateGroupKeys(String userId, String groupId) {
        assertGroupAdminOrOwner(userId, groupId);
        groupKeyWrapMapper.deleteByGroup(groupId);
    }

    private void assertGroupMember(String userId, String groupId) {
        if (groupMemberMapper.selectMember(groupId, userId) == null) {
            throw new BusinessException("im.group.not.member");
        }
    }

    private void assertGroupAdminOrOwner(String userId, String groupId) {
        var member = groupMemberMapper.selectMember(groupId, userId);
        if (member == null) {
            throw new BusinessException("im.group.not.member");
        }
        String role = StringUtils.defaultString(member.getRole());
        if (!ImConstants.ROLE_OWNER.equals(role) && !ImConstants.ROLE_ADMIN.equals(role)) {
            throw new BusinessException("im.crypto.group.wrap.forbidden");
        }
    }

    private Set<String> memberIds(String groupId) {
        List<String> ids = groupMemberMapper.listUserIds(groupId);
        return new HashSet<>(ids);
    }
}
