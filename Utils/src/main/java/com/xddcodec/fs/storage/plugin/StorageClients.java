/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.plugin;

import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import com.xddcodec.fs.storage.plugin.s3.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Slf4j
@Component
@RequiredArgsConstructor
public class StorageClients implements DisposableBean {

    public static final String LOCAL = "Local";

    private final LocalStorageOperationService localStore;
    private final Map<String, IStorageOperationService> s3Clients = new ConcurrentHashMap<String, IStorageOperationService>();

    public static boolean isLocal(String configId) {
        return configId == null || LOCAL.equals(configId);
    }

    public static String normalize(String configId) {
        return isLocal(configId) ? null : configId;
    }

    public IStorageOperationService getLocal() {
        return localStore;
    }

    public IStorageOperationService getOrCreate(String configId, Supplier<Map<String, Object>> configLoader) {
        if (isLocal(configId)) {
            return localStore;
        }
        return s3Clients.computeIfAbsent(configId, id -> new S3StorageService(configLoader.get()));
    }

    public void invalidate(String configId) {
        if (isLocal(configId)) {
            return;
        }
        closeQuietly(s3Clients.remove(configId));
    }

    public boolean hasInstance(String configId) {
        if (isLocal(configId)) {
            return true;
        }
        return s3Clients.containsKey(configId);
    }

    public void destroy() {
        java.util.Iterator<IStorageOperationService> it = s3Clients.values().iterator();
        while (it.hasNext()) {
            closeQuietly(it.next());
        }
        s3Clients.clear();
    }

    private void closeQuietly(IStorageOperationService client) {
        if (client == null) {
            return;
        }
        try {
            client.close();
        } catch (IOException e) {
            log.warn("关闭存储客户端失败: {}", e.getMessage());
        }
    }
}
