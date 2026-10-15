/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Framework.common.enums.LoginType;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.system.auth.LoginStrategy;
import com.xddcodec.fs.system.auth.PasswordHashService;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.dto.LoginCmd;
import com.xddcodec.fs.System.domain.vo.LoginResult;
import com.xddcodec.fs.system.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 账号密码登录策略
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
@Component
@RequiredArgsConstructor
public class PasswordLoginStrategy implements LoginStrategy {

    private final SysUserMapper userMapper;

    private final PasswordHashService passwordHashService;

    private final static String emailRegex = "^[A-Za-z0-9+_.-]+@(.+)$";

    @Override
    public LoginType getLoginType() {
        return LoginType.password;
    }

    @Override
    public LoginResult authenticate(LoginCmd cmd) {
        String account = cmd.getAccount();
        String password = cmd.getPassword();
        SysUser user = account.matches(emailRegex)
                ? userMapper.selectByEmail(account)
                : userMapper.selectByUsername(account);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_ACCOUNT_OR_PASSWORD_INCORRECT);
        }
        if (user.getStatus() == 1) {
            throw new BusinessException(ErrorMessages.USER_DISABLED);
        }
        if (!passwordHashService.matches(password, user.getPassword())) {
            throw new BusinessException(ErrorMessages.USER_ACCOUNT_OR_PASSWORD_INCORRECT);
        }

        if (passwordHashService.isLegacyHash(user.getPassword())) {
            user.setPassword(passwordHashService.encode(password));
        }

        LoginResult loginResult = new LoginResult();
        loginResult.setId(user.getId());
        loginResult.setUsername(user.getUsername());
        //修改最后登录时间
        user.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(user);
        return loginResult;
    }
}
