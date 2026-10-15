/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.dto.LoginCmd;
import com.xddcodec.fs.System.domain.vo.LoginResult;

/**
 * 认证服务接口
 *
 * @Author: xddcode
 * @Date: 2024/10/16 14:25
 */
public interface AuthService {

    /**
     * 登录
     *
     * @param cmd
     * @return
     */
    LoginResult doLogin(LoginCmd cmd);

    /**
     * 退出登录
     */
    void logout();

    /**
     * 发送登录验证码
     *
     * @param account 账号（邮箱）
     */
    void sendLoginEmailCode(String account);
}
