/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Framework.common.enums.LoginType;
import com.xddcodec.fs.Exception.BusinessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.xddcodec.fs.system.auth.LoginStrategy;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.dto.LoginCmd;
import com.xddcodec.fs.System.domain.vo.LoginResult;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 邮箱验证码登录策略
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
@Component
@RequiredArgsConstructor
public class EmailLoginStrategy implements LoginStrategy {

    private final SysUserMapper userMapper;
    private final StringRedisTemplate redis;

    @Value("${fs.redis-prefix}")
    private String redisPrefix;

    @Override
    public LoginType getLoginType() {
        return LoginType.email_code;
    }

    @Override
    public LoginResult authenticate(LoginCmd cmd) {
        String account = cmd.getAccount();
        String code = cmd.getPassword();

        if (code == null || code.isBlank()) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_REQUIRED);
        }

        String redisKey = redisPrefix + ":login:" + account;
        String cachedCode = redis.opsForValue().get(redisKey);

        if (cachedCode == null) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_EXPIRED);
        }
        if (!code.equals(cachedCode)) {
            throw new BusinessException(ErrorMessages.USER_VERIFICATION_CODE_INCORRECT);
        }

        SysUser user = userMapper.selectByUsernameOrEmail(account);

        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }

        redis.delete(redisKey);

        LoginResult loginResult = new LoginResult();
        loginResult.setId(user.getId());
        loginResult.setUsername(user.getUsername());
        //修改最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(user);
        return loginResult;
    }
}
