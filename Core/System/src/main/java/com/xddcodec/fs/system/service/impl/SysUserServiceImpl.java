/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.RandomUtil;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Mail.MailService;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.xddcodec.fs.storage.plugin.StorageClients;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import com.xddcodec.fs.system.auth.PasswordHashService;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.dto.*;
import com.xddcodec.fs.System.domain.vo.SysUserVO;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import com.xddcodec.fs.system.service.SysUserService;
import com.xddcodec.fs.system.service.SysUserTransferSettingService;
import com.xddcodec.fs.system.service.SysWorkspaceInvitationService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.Serializable;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * 用户表 服务实现类
 *
 * @Author: xddcode
 * @Date: 2024/6/7 11:14
 */
@Service
@RequiredArgsConstructor
public class SysUserServiceImpl implements SysUserService {

    private final SysUserMapper userMapper;

    private final Converter converter;

    private final StringRedisTemplate redis;

    private final MailService mailService;

    private final CacheManager cacheManager;

    private final SysUserTransferSettingService userTransferSettingService;

    @Lazy
    @Autowired
    private SysWorkspaceInvitationService workspaceInvitationService;

    private final StorageClients storageClients;

    private final PasswordHashService passwordHashService;

    @Value("${spring.application.name:free-fs}")
    private String applicationName;

    @Value("${fs.verify-code-length}")
    private Integer verifyCodeLength;

    @Value("${fs.verify-code-expire-seconds}")
    private Long verifyCodeExpireSeconds;

    @Value("${fs.verify-code-send-interval-seconds}")
    private Long verifyCodeSendIntervalSeconds;

    @Value("${fs.avatar-save-path}")
    private String avatarSavePath;

    @Value("${fs.redis-prefix}")
    private String redisPrefix;

    @Override
    public SysUser getById(Serializable id) {
        return userMapper.selectById(id == null ? null : id.toString());
    }

    @Override
    public void updateById(SysUser user) {
        userMapper.updateById(user);
    }

    @Override
    public SysUser getByUsername(String username) {
        return userMapper.selectByUsername(username);
    }

    @Override
    public SysUser getByMail(String email) {
        return userMapper.selectByEmail(email);
    }

    @Override
    @Cacheable(value = "user", keyGenerator = "userKeyGenerator")
    public SysUserVO getDetail() {
        String userId = UserContext.getUserId();
        SysUser user = userMapper.selectById(userId);
        SysUserVO userVO = converter.convert(user, SysUserVO.class);
        if (user != null) {
            // 设置用户是否已设置密码
            userVO.setIsSetPassword(user.getPassword() != null);
        }
        return userVO;
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void register(UserRegisterCmd cmd) {
        SysUser user = this.getByUsername(cmd.getUsername());
        if (user != null) {
            throw new BusinessException(ErrorMessages.USER_USERNAME_EXISTS);
        }
        if (!cmd.getPassword().equals(cmd.getConfirmPassword())) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_NOT_MATCH);
        }
        user = new SysUser();
        user.setUsername(cmd.getUsername());
        user.setPassword(passwordHashService.encode(cmd.getPassword()));
        user.setEmail(cmd.getEmail().trim().toLowerCase(Locale.ROOT));
        user.setNickname(cmd.getNickname());
        user.setAvatar(cmd.getAvatar());
        user.setId(UUID.randomUUID().toString().replace("-", ""));
        userMapper.insert(user);

        // 初始化用户传输配置
        userTransferSettingService.initUserTransferSetting(user.getId());

        // 处理邀请令牌
        if (cmd.getInviteToken() != null && !cmd.getInviteToken().isBlank()) {
            workspaceInvitationService.acceptInvitation(cmd.getInviteToken(), user.getId());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    @CacheEvict(value = "user", keyGenerator = "userKeyGenerator")
    public void editUserInfo(UserEditInfoCmd cmd) {
        String userId = UserContext.getUserId();
        SysUser existUser = userMapper.selectById(userId);
        if (existUser == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        existUser.setNickname(cmd.getNickname());
        userMapper.updateById(existUser);
    }

    @Override
    public void sendUpdateMailCode(String mail) {
        String normalizedMail = mail.trim().toLowerCase(Locale.ROOT);
        enforceVerificationCodeRateLimit("updateMail", normalizedMail);

        String userId = UserContext.getUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        SysUser existUser = userMapper.selectByEmail(normalizedMail);
        if (existUser != null && !existUser.getId().equals(user.getId())) {
            throw new BusinessException(ErrorMessages.USER_EMAIL_EXISTS);
        }
        String code = RandomUtil.randomNumbers(verifyCodeLength);
        String redisKey = redisPrefix + ":updateMail:" + normalizedMail;
        redis.opsForValue().set(redisKey, code, java.time.Duration.ofSeconds(verifyCodeExpireSeconds));

        mailService.sendVerifyCode(normalizedMail, user.getNickname(), code);
    }

    @Override
    public void updateMail(UserEditMailCmd cmd) {
        String userId = UserContext.getUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        String email = cmd.getEmail().trim().toLowerCase(Locale.ROOT);
        SysUser existUser = userMapper.selectByEmail(email);
        if (existUser != null && !existUser.getId().equals(user.getId())) {
            throw new BusinessException(ErrorMessages.USER_EMAIL_EXISTS);
        }
        String code = cmd.getCode();
        String redisKey = redisPrefix + ":updateMail:" + email;
        String redisCode = redis.opsForValue().get(redisKey);
        if (!code.equals(redisCode)) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_INCORRECT);
        }

        user.setEmail(email);
        userMapper.updateById(user);
        redis.delete(redisKey);

        Cache userCache = cacheManager.getCache("user");
        if (userCache != null) {
            userCache.evict(user.getId());
        }
    }

    @Override
    public void uploadAvatar(MultipartFile file) {
        String userId = UserContext.getUserId();
        SysUser existUser = userMapper.selectById(userId);
        if (existUser == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }

        String avatarPath;
        try {
            LocalStorageOperationService storage = (LocalStorageOperationService) storageClients.getLocal();
            String suffix = FileUtil.getSuffix(file.getOriginalFilename());
            String fileName = userId + "_" + System.currentTimeMillis() + "." + suffix;
            String objectKey = applicationName + avatarSavePath + "/" + userId + "/" + fileName;
            storage.uploadFile(file.getInputStream(), objectKey);
            avatarPath = storage.getRelativeFilePath(objectKey);
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }

        updateUserAvatarInTransaction(existUser, avatarPath);
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateUserAvatarInTransaction(SysUser user, String url) {
        user.setAvatar(url);
        userMapper.updateById(user);
        Objects.requireNonNull(cacheManager.getCache("user")).evict(user.getId());
    }


    @Override
    @CacheEvict(value = "user", keyGenerator = "userKeyGenerator")
    public void updatePassword(PasswordEditCmd cmd) {
        String userId = UserContext.getUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        if (!passwordHashService.matches(cmd.getOldPassword(), user.getPassword())) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_INCORRECT);
        }
        if (!cmd.getNewPassword().equals(cmd.getConfirmPassword())) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_NOT_MATCH);
        }
        user.setPassword(passwordHashService.encode(cmd.getNewPassword()));
        userMapper.updateById(user);
    }

    @Override
    public void setPassword(PasswordAddCmd cmd) {
        String userId = UserContext.getUserId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_ALREADY_SET);
        }
        if (!cmd.getNewPassword().equals(cmd.getConfirmPassword())) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_NOT_MATCH);
        }
        user.setPassword(passwordHashService.encode(cmd.getNewPassword()));
        userMapper.updateById(user);
    }

    @Override
    public void sendForgetPasswordCode(String email) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        enforceVerificationCodeRateLimit("forgetPassword", normalizedEmail);

        SysUser user = userMapper.selectByEmail(normalizedEmail);
        if (user == null) {
            // 对不存在的账号同样返回成功，避免泄露账号是否已注册。
            return;
        }
        String code = RandomUtil.randomNumbers(verifyCodeLength);
        String redisKey = redisPrefix + ":forgetPassword:" + normalizedEmail;
        redis.opsForValue().set(redisKey, code, java.time.Duration.ofSeconds(verifyCodeExpireSeconds));

        mailService.sendVerifyCode(normalizedEmail, user.getNickname(), code);
    }

    @Override
    public void updateForgetPassword(PasswordForgetEditCmd cmd) {
        String email = cmd.getMail().trim().toLowerCase(Locale.ROOT);
        String code = cmd.getCode();
        String redisKey = redisPrefix + ":forgetPassword:" + email;
        String redisCode = redis.opsForValue().get(redisKey);
        if (!code.equals(redisCode)) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_INCORRECT);
        }
        SysUser user = userMapper.selectByEmail(email);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_INCORRECT);
        }
        if (!cmd.getNewPassword().equals(cmd.getConfirmPassword())) {
            throw new BusinessException(ErrorMessages.USER_PASSWORD_NOT_MATCH);
        }
        user.setPassword(passwordHashService.encode(cmd.getNewPassword()));
        userMapper.updateById(user);
        redis.delete(redisKey);

        Cache userCache = cacheManager.getCache("user");
        if (userCache != null) {
            userCache.evict(user.getId());
        }
    }

    private void enforceVerificationCodeRateLimit(String scene, String email) {
        String rateLimitKey = redisPrefix + ":codeRate:" + scene + ":" + email;
        Boolean acquired = redis.opsForValue().setIfAbsent(
                rateLimitKey,
                "1",
                java.time.Duration.ofSeconds(verifyCodeSendIntervalSeconds)
        );
        if (!Boolean.TRUE.equals(acquired)) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_TOO_FREQUENT);
        }
    }
}
