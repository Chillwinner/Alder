/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Framework.common.enums.LoginType;
import com.xddcodec.fs.Exception.BusinessException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录策略工厂
 *
 * @Author: xddcode
 * @Date: 2026/4/2 09:59
 */
@Service
public class LoginStrategyFactory {

    private final Map<LoginType, LoginStrategy> strategyMap = new ConcurrentHashMap<>();

    public LoginStrategyFactory(List<LoginStrategy> strategies) {
        strategies.forEach(s -> strategyMap.put(s.getLoginType(), s));
    }

    public LoginStrategy getStrategy(LoginType type) {
        LoginStrategy strategy = strategyMap.get(type);
        if (strategy == null) {
            throw new BusinessException(ErrorMessages.AUTH_LOGIN_TYPE_NOT_SUPPORTED);
        }
        return strategy;
    }
}
