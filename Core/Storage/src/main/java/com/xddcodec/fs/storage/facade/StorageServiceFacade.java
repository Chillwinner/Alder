/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.facade;

import com.xddcodec.fs.Exception.ErrorMessages;

import cn.hutool.core.util.StrUtil;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.StorageConfigException;
import com.xddcodec.fs.Storage.domain.StorageSetting;
import com.xddcodec.fs.storage.mapper.StorageSettingMapper;
import com.xddcodec.fs.storage.plugin.StorageClients;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import com.xddcodec.fs.storage.plugin.s3.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * 存储服务门面
 * 职责：
 * 1. 提供统一的存储服务访问入口
 * 2. 整合上下文、配置加载、实例管理
 * 3. 对外隐藏内部实现细节
 *
 * @Author: xddcode
 * @Date: 2024/10/26
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageServiceFacade {

    private final StorageClients storageClients;
    private final StorageSettingMapper storageSettingMapper;
    private final ObjectMapper objectMapper;

    /**
     * 获取当前上下文的存储服务
     * 从 ThreadLocal 获取 configId，然后获取对应的存储实例
     *
     * @return 存储服务实例
     */
    public IStorageOperationService getCurrentStorageService() {
        String configId = StorageContext.getConfigId();
        return getStorageService(configId);
    }

    /**
     * 根据配置ID获取存储服务（推荐使用）
     * <p>
     * 外接配置必须属于当前工作空间；无空间上下文时拒绝，避免外链空头请求跨空间打开桶。
     *
     * @param configId 配置ID（可从 FileInfo.storagePlatformSettingId 获取）
     * @return 存储服务实例
     */
    public IStorageOperationService getStorageService(String configId) {
        if (StorageClients.isLocal(configId)) {
            return storageClients.getLocal();
        }
        StorageSetting settings = storageSettingMapper.selectById(configId);
        assertCurrentWorkspaceOwns(settings);
        return storageClients.getOrCreate(configId, () -> parseConfigData(settings));
    }

    public boolean isLocal(String configId) {
        return StorageClients.isLocal(configId);
    }

    public LocalStorageOperationService getLocalStore() {
        return (LocalStorageOperationService) storageClients.getLocal();
    }

    public S3StorageService getS3(String configId) {
        if (StorageClients.isLocal(configId)) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_FOUND);
        }
        return (S3StorageService) getStorageService(configId);
    }

    /**
     * 刷新存储实例
     * 先失效缓存，下次使用时自动重新加载
     *
     * @param configId 配置ID
     */
    public void refreshInstance(String configId) {
        if (StorageClients.isLocal(configId)) {
            log.warn("Local 存储实例不支持刷新");
            return;
        }

        // 检查是否有缓存实例
        if (!storageClients.hasInstance(configId)) {
            return;
        }
        storageClients.invalidate(configId);
    }

    /**
     * 移除存储实例
     * 用于删除配置或禁用配置时清理缓存
     *
     * @param configId 配置ID
     */
    public void removeInstance(String configId) {
        if (StorageClients.isLocal(configId)) {
            log.warn("Local 存储实例不支持移除");
            return;
        }

        log.info("移除存储实例: configId={}", configId);

        // 直接失效缓存，不需要加载配置
        storageClients.invalidate(configId);
    }

    /**
     * 从数据库加载配置（仅在缓存未命中时调用）
     *
     * @param configId 配置ID
     * @return 存储配置对象
     * @throws BusinessException 配置不存在或无效时抛出
     */
    private void assertCurrentWorkspaceOwns(StorageSetting settings) {
        if (settings == null) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_FOUND);
        }
        if (settings.getDeleted() != null && settings.getDeleted() == 1) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_DELETED);
        }
        if (settings.getEnabled() != null && settings.getEnabled() == 0) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_DISABLED);
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StrUtil.isBlank(workspaceId) || !workspaceId.equals(settings.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NO_PERMISSION);
        }
    }

    private Map<String, Object> parseConfigData(StorageSetting settings) {
        try {
            if (StrUtil.isBlank(settings.getConfigData())) {
                throw new StorageConfigException(ErrorMessages.STORAGE_CONFIG_DATA_EMPTY);
            }
            return objectMapper.readValue(
                    settings.getConfigData(),
                    new TypeReference<Map<String, Object>>() {
                    }
            );
        } catch (StorageConfigException e) {
            throw e;
        } catch (Exception e) {
            throw new StorageConfigException(ErrorMessages.STORAGE_CONFIG_DATA_PARSE_FAILED, e);
        }
    }
}
