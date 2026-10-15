/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import cn.hutool.core.collection.CollUtil;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.common.utils.JsonUtils;
import com.xddcodec.fs.Storage.domain.StoragePlatform;
import com.xddcodec.fs.Storage.domain.StorageSetting;
import com.xddcodec.fs.Storage.domain.cmd.StorageSettingAddCmd;
import com.xddcodec.fs.Storage.domain.cmd.StorageSettingEditCmd;
import com.xddcodec.fs.Storage.domain.vo.StorageActivePlatformsVO;
import com.xddcodec.fs.Storage.domain.vo.StoragePlatformVO;
import com.xddcodec.fs.Storage.domain.vo.StorageSettingUserVO;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.mapper.StorageSettingMapper;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.storage.plugin.StorageClients;
import com.xddcodec.fs.storage.service.StoragePlatformService;
import com.xddcodec.fs.storage.service.StorageSettingService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.core.type.TypeReference;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 存储平台配置业务接口实现
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:38
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StorageSettingServiceImpl implements StorageSettingService {

    private static final String SECRET_MASK = "********";

    private final StorageSettingMapper storageSettingMapper;

    private final Converter converter;

    private final StoragePlatformService storagePlatformService;

    private final StorageServiceFacade storageServiceFacade;

    @Value("${fs.status-enabled}")
    private Integer statusEnabled;

    @Value("${fs.status-disabled}")
    private Integer statusDisabled;


    @Override
    public StorageSetting getById(Serializable id) {
        return storageSettingMapper.selectById(id == null ? null : id.toString());
    }

    @Override
    @Cacheable(value = "storageSettings", keyGenerator = "storageSettingKeyGenerator", unless = "#result == null || #result.isEmpty()")
    public List<StorageSettingUserVO> getStorageSettingsByUser() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<StorageSetting> storageSettings = storageSettingMapper.selectByWorkspaceId(workspaceId);
        if (CollUtil.isEmpty(storageSettings)) {
            return new ArrayList<>();
        }
        return storageSettings.stream().map(storageSetting -> {
            StorageSettingUserVO vo = converter.convert(storageSetting, StorageSettingUserVO.class);
            vo.setConfigData(maskSensitiveConfig(storageSetting.getConfigData()));
            StoragePlatform storagePlatform = storagePlatformService.getStoragePlatformByIdentifier(storageSetting.getPlatformIdentifier());
            StoragePlatformVO storagePlatformVO = converter.convert(storagePlatform, StoragePlatformVO.class);
            vo.setStoragePlatform(storagePlatformVO);
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    @Cacheable(value = "storageActivePlatforms", keyGenerator = "storageSettingKeyGenerator", unless = "#result == null || #result.isEmpty()")
    public List<StorageActivePlatformsVO> getActiveStoragePlatforms() {
        String workspaceId = WorkspaceContext.getWorkspaceId();

        StorageSetting storageSetting = storageSettingMapper.selectEnabledByWorkspaceId(workspaceId, statusEnabled);
        List<StorageActivePlatformsVO> result = new ArrayList<>();
        // 添加默认本地存储平台
        StorageActivePlatformsVO localInstance = new StorageActivePlatformsVO();
        localInstance.setSettingId(StorageClients.LOCAL);
        localInstance.setPlatformIdentifier(StorageClients.LOCAL);
        localInstance.setPlatformIcon("icon-bendicunchu1");
        localInstance.setPlatformName("本地存储");
        localInstance.setIsEnabled(true);
        localInstance.setRemark("");
        if (storageSetting != null) {
            localInstance.setIsEnabled(false);
            StoragePlatform storagePlatform = storagePlatformService.getStoragePlatformByIdentifier(storageSetting.getPlatformIdentifier());
            StorageActivePlatformsVO vo = new StorageActivePlatformsVO();
            vo.setSettingId(storageSetting.getId());
            vo.setPlatformIdentifier(storageSetting.getPlatformIdentifier());
            if (storagePlatform != null) {
                vo.setPlatformIcon(storagePlatform.getIcon());
                vo.setPlatformName(storagePlatform.getName());
            }
            vo.setRemark(storageSetting.getRemark());
            vo.setCreatedAt(storageSetting.getCreatedAt());
            vo.setUpdatedAt(storageSetting.getUpdatedAt());
            vo.setIsEnabled(true);
            result.add(vo);
        }
        result.add(localInstance);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @Caching(evict = {
            @CacheEvict(value = "storageSettings", keyGenerator = "storageSettingKeyGenerator"),
            @CacheEvict(value = "storageActivePlatforms", keyGenerator = "storageSettingKeyGenerator")
    })
    public void enableOrDisableStoragePlatform(String settingId, Integer action) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        StorageSetting storageSetting = storageSettingMapper.selectById(settingId);
        if (storageSetting == null) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_EXIST);
        }
        if (!workspaceId.equals(storageSetting.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NO_PERMISSION_MODIFY);
        }

        Integer newStatus = action == 0 ? statusDisabled : statusEnabled;

        if (newStatus.equals(statusEnabled)) {
            List<StorageSetting> storageSettings =
                    storageSettingMapper.selectEnabledListByWorkspaceId(workspaceId, statusEnabled);
            storageSettings.forEach(s -> {
                s.setEnabled(statusDisabled);
                storageSettingMapper.updateById(s);
            });
        }
        storageSetting.setEnabled(newStatus);
        storageSettingMapper.updateById(storageSetting);

        if (newStatus.equals(statusDisabled)) {
            storageServiceFacade.removeInstance(settingId);
        } else {
            storageServiceFacade.refreshInstance(settingId);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    @Caching(evict = {
            @CacheEvict(value = "storageSettings", keyGenerator = "storageSettingKeyGenerator"),
            @CacheEvict(value = "storageActivePlatforms", keyGenerator = "storageSettingKeyGenerator")
    })
    public void addStorageSetting(StorageSettingAddCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        boolean exists = this.checkDuplicateConfig(
                cmd.getPlatformIdentifier(),
                workspaceId,
                cmd.getConfigData()
        );
        if (exists) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_DUPLICATE);
        }
        StorageSetting storageSetting = new StorageSetting();
        storageSetting.setPlatformIdentifier(cmd.getPlatformIdentifier());
        storageSetting.setWorkspaceId(workspaceId);
        storageSetting.setConfigData(cmd.getConfigData());
        storageSetting.setEnabled(statusDisabled);
        storageSetting.setRemark(cmd.getRemark());
        storageSetting.setId(UUID.randomUUID().toString().replace("-", ""));
        storageSettingMapper.insert(storageSetting);
        log.info("新增存储配置成功: settingId={}, platform={}, workspaceId={}",
                storageSetting.getId(),
                cmd.getPlatformIdentifier(),
                workspaceId);
    }

    /**
     * 检查是否存在重复配置
     */
    private boolean checkDuplicateConfig(String platformIdentifier,
                                         String workspaceId,
                                         String configData) {
        List<StorageSetting> existingSettings =
                storageSettingMapper.selectByWorkspaceAndPlatform(workspaceId, platformIdentifier);
        // 将新配置转为标准JSON格式
        String normalizedNewConfig = JsonUtils.normalizeJson(configData);
        // 遍历现有配置，比较JSON内容
        return existingSettings.stream()
                .anyMatch(setting -> {
                    String normalizedExisting = JsonUtils.normalizeJson(setting.getConfigData());
                    return normalizedNewConfig.equals(normalizedExisting);
                });
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    @Caching(evict = {
            @CacheEvict(value = "storageSettings", keyGenerator = "storageSettingKeyGenerator"),
            @CacheEvict(value = "storageActivePlatforms", keyGenerator = "storageSettingKeyGenerator")
    })
    public void editStorageSetting(StorageSettingEditCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        StorageSetting storageSetting = storageSettingMapper.selectById(cmd.getSettingId());
        if (storageSetting == null) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_EXIST);
        }
        if (!workspaceId.equals(storageSetting.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NO_PERMISSION_MODIFY);
        }
        String mergedConfigData = mergeSensitiveConfig(storageSetting.getConfigData(), cmd.getConfigData());
        boolean exists = this.checkDuplicateConfigForUpdate(
                storageSetting.getPlatformIdentifier(),
                workspaceId,
                mergedConfigData,
                cmd.getSettingId()
        );
        if (exists) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_DUPLICATE);
        }
        storageSetting.setConfigData(mergedConfigData);
        storageSetting.setRemark(cmd.getRemark());
        storageSettingMapper.updateById(storageSetting);
        // 刷新缓存
        storageServiceFacade.refreshInstance(cmd.getSettingId());
    }

    /**
     * 检查更新时是否存在重复配置（排除自身）
     */
    private boolean checkDuplicateConfigForUpdate(String platformIdentifier,
                                                  String workspaceId,
                                                  String configData,
                                                  String excludeId) {
        List<StorageSetting> existingSettings = storageSettingMapper.selectByWorkspaceAndPlatformExcludeId(
                workspaceId, platformIdentifier, excludeId);
        String normalizedNewConfig = JsonUtils.normalizeJson(configData);
        return existingSettings.stream()
                .anyMatch(setting -> {
                    String normalizedExisting = JsonUtils.normalizeJson(setting.getConfigData());
                    return normalizedNewConfig.equals(normalizedExisting);
                });
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    @Caching(evict = {
            @CacheEvict(value = "storageSettings", keyGenerator = "storageSettingKeyGenerator"),
            @CacheEvict(value = "storageActivePlatforms", keyGenerator = "storageSettingKeyGenerator")
    })
    public void deleteStorageSettingById(String id) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        StorageSetting storageSetting = storageSettingMapper.selectById(id);

        if (storageSetting == null) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_EXIST);
        }
        if (!workspaceId.equals(storageSetting.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NO_PERMISSION_DELETE);
        }
        String cacheSettingId = StorageContext.getConfigId();
        if (id.equals(cacheSettingId)) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_IN_USE);
        }

        storageSettingMapper.deleteById(id);
        storageServiceFacade.removeInstance(id);

        log.info("存储配置已删除并移除缓存: settingId={}, workspaceId={}", id, workspaceId);
    }

    @Override
    public List<StorageSetting> listByPlatformIdentifier(String platformIdentifier) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        return storageSettingMapper.selectEnabledByWorkspaceAndPlatform(
                workspaceId, platformIdentifier, statusEnabled);
    }

    private String maskSensitiveConfig(String configData) {
        Map<String, Object> config = parseConfig(configData);
        config.replaceAll((key, value) -> isSensitiveKey(key) && value != null ? SECRET_MASK : value);
        return JsonUtils.toJsonString(config);
    }

    private String mergeSensitiveConfig(String existingConfigData, String incomingConfigData) {
        Map<String, Object> existing = parseConfig(existingConfigData);
        Map<String, Object> incoming = parseConfig(incomingConfigData);
        existing.forEach((key, value) -> {
            Object incomingValue = incoming.get(key);
            if (isSensitiveKey(key)
                    && (incomingValue == null
                    || String.valueOf(incomingValue).isBlank()
                    || SECRET_MASK.equals(String.valueOf(incomingValue)))) {
                incoming.put(key, value);
            }
        });
        return JsonUtils.toJsonString(incoming);
    }

    private Map<String, Object> parseConfig(String configData) {
        Map<String, Object> config = JsonUtils.parseObject(
                configData,
                new TypeReference<LinkedHashMap<String, Object>>() { }
        );
        return config == null ? new LinkedHashMap<>() : config;
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key.toLowerCase(Locale.ROOT);
        return normalized.contains("secret")
                || normalized.contains("password")
                || normalized.contains("token")
                || (normalized.contains("access") && normalized.contains("key"));
    }
}
