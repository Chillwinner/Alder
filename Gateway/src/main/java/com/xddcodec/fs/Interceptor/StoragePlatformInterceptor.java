/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Interceptor;

import com.xddcodec.fs.storage.plugin.StorageClients;
import com.xddcodec.fs.Context.StorageContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class StoragePlatformInterceptor implements HandlerInterceptor {

    @Value("${fs.header-storage-platform-config-id}")
    private String storagePlatformHeader;

    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        StorageContext.setConfigId(
                StorageClients.normalize(request.getHeader(storagePlatformHeader)));
        return true;
    }

    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        StorageContext.clear();
    }
}
