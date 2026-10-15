/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth;

import com.xddcodec.fs.Framework.common.enums.LoginType;
import com.xddcodec.fs.System.domain.dto.LoginCmd;
import com.xddcodec.fs.System.domain.vo.LoginResult;

/**
 * 登录策略接口
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
public interface LoginStrategy {

    /**
     * 获取登录类型
     *
     * @return 登录类型
     */
    LoginType getLoginType();


    /**
     * 登录认证
     *
     * @param cmd 登录参数
     * @return 登录结果
     */
    LoginResult authenticate(LoginCmd cmd);
}
