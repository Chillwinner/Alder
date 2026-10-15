/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import cn.dev33.satoken.stp.SaTokenInfo;
import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.RandomUtil;
import com.xddcodec.fs.Mail.MailService;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.xddcodec.fs.log.annotation.LoginLog;
import com.xddcodec.fs.system.auth.LoginStrategy;
import com.xddcodec.fs.system.auth.LoginStrategyFactory;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.dto.LoginCmd;
import com.xddcodec.fs.System.domain.vo.LoginResult;
import com.xddcodec.fs.system.service.AuthService;
import com.xddcodec.fs.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

/**
 * 认证服务实现
 *
 * @Author: xddcode
 * @Date: 2024/10/16 14:26
 */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final LoginStrategyFactory loginStrategyFactory;
    private final SysUserService sysUserService;
    private final StringRedisTemplate redis;
    private final MailService mailService;

    @Value("${fs.verify-code-length}")
    private Integer verifyCodeLength;

    @Value("${fs.verify-code-expire-seconds}")
    private Long verifyCodeExpireSeconds;

    @Value("${fs.verify-code-send-interval-seconds}")
    private Long verifyCodeSendIntervalSeconds;

    @Value("${fs.redis-prefix}")
    private String redisPrefix;

    @Override
    @LoginLog()
    public LoginResult doLogin(LoginCmd cmd) {
        LoginStrategy strategy = loginStrategyFactory.getStrategy(cmd.getLoginType());
        LoginResult result = strategy.authenticate(cmd);

        StpUtil.login(result.getId(), cmd.getIsRemember());
        StpUtil.getSession().set("username", result.getUsername());
        SaTokenInfo tokenInfo = StpUtil.getTokenInfo();
        result.setAccessToken(tokenInfo.getTokenValue());
        //修改最后登录时间
        SysUser user = new SysUser();
        user.setId(result.getId());
        user.setLastLoginAt(LocalDateTime.now());
        sysUserService.updateById(user);
        return result;
    }

    @Override
    public void logout() {
        StpUtil.logout();
    }

    @Override
    public void sendLoginEmailCode(String account) {
        String normalizedAccount = account.trim().toLowerCase(Locale.ROOT);
        enforceVerificationCodeRateLimit("login", normalizedAccount);

        SysUser user = sysUserService.getByMail(normalizedAccount);
        if (user == null) {
            // 对不存在的账号同样返回成功，避免泄露账号是否已注册。
            return;
        }

        // 生成验证码
        String code = RandomUtil.randomNumbers(verifyCodeLength);
        String redisKey = redisPrefix + ":login:" + normalizedAccount;
        redis.opsForValue().set(redisKey, code, java.time.Duration.ofSeconds(verifyCodeExpireSeconds));

        // 发送邮件
        mailService.sendVerifyCode(user.getEmail(), user.getNickname(), code);
    }

    private void enforceVerificationCodeRateLimit(String scene, String email) {
        String rateLimitKey = redisPrefix + ":codeRate:" + scene + ":" + email;
        Boolean acquired = redis.opsForValue().setIfAbsent(
                rateLimitKey,
                "1",
                java.time.Duration.ofSeconds(verifyCodeSendIntervalSeconds)
        );
        if (!Boolean.TRUE.equals(acquired)) {
            throw new com.xddcodec.fs.Exception.BusinessException(
                    "user.verification.code.too.frequent"
            );
        }
    }
}
