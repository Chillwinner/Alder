/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.service;

import com.xddcodec.fs.Storage.domain.StoragePlatform;
import com.xddcodec.fs.storage.StoragePlatforms;
import com.xddcodec.fs.storage.mapper.StoragePlatformMapper;
import com.xddcodec.fs.storage.mapper.StorageSettingMapper;
import com.xddcodec.fs.storage.plugin.StorageClients;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class StoragePlatformAutoRegister implements ApplicationRunner {

    private final StoragePlatformMapper storagePlatformMapper;
    private final StorageSettingMapper storageSettingMapper;

    @Override
    public void run(@NonNull ApplicationArguments args) {
        try {
            sync();
        } catch (DataAccessException e) {
            log.warn("数据库不可用，跳过存储平台同步: {}", e.getMessage());
        } catch (Exception e) {
            log.error("存储平台同步失败", e);
        }
    }

    public void sync() {
        for (StoragePlatforms.Platform platform : StoragePlatforms.remotePlatforms()) {
            upsert(platform);
        }
        migrateLegacyS3Identifiers();
        removeRetiredPlatforms();
    }

    private void upsert(StoragePlatforms.Platform def) {
        StoragePlatform existing = storagePlatformMapper.selectByIdentifier(def.identifier());
        if (existing == null) {
            StoragePlatform row = new StoragePlatform();
            row.setIdentifier(def.identifier());
            row.setName(def.name());
            row.setConfigScheme(def.configScheme());
            row.setIcon(def.icon());
            row.setLink(def.link());
            row.setDesc(def.description());
            row.setIsDefault(0);
            storagePlatformMapper.insert(row);
            log.info("新增存储平台: {}", def.identifier());
            return;
        }
        if (needsUpdate(existing, def)) {
            existing.setName(def.name());
            existing.setConfigScheme(def.configScheme());
            existing.setIcon(def.icon());
            existing.setLink(def.link());
            existing.setDesc(def.description());
            storagePlatformMapper.updateById(existing);
            log.info("更新存储平台: {}", def.identifier());
        }
    }

    private boolean needsUpdate(StoragePlatform existing, StoragePlatforms.Platform def) {
        return !Objects.equals(existing.getName(), def.name())
                || !Objects.equals(existing.getConfigScheme(), def.configScheme())
                || !Objects.equals(existing.getIcon(), def.icon())
                || !Objects.equals(existing.getLink(), def.link())
                || !Objects.equals(existing.getDesc(), def.description());
    }

    private void migrateLegacyS3Identifiers() {
        for (String legacy : new String[]{"Minio", "AliyunOSS", "Obs", "RustFS"}) {
            int changed = storageSettingMapper.migratePlatformIdentifier(legacy, StoragePlatforms.S3);
            if (changed > 0) {
                log.info("已将 {} 条存储配置的平台标识从 {} 迁移为 S3", changed, legacy);
            }
        }
    }

    private void removeRetiredPlatforms() {
        Set<String> keep = StoragePlatforms.remotePlatforms().stream()
                .map(StoragePlatforms.Platform::identifier)
                .collect(Collectors.toSet());
        keep.add(StorageClients.LOCAL);

        for (StoragePlatform platform : storagePlatformMapper.selectAll()) {
            if (keep.contains(platform.getIdentifier())) {
                continue;
            }
            storagePlatformMapper.deleteById(platform.getId());
            log.info("已下线存储平台，从数据库移除: {}", platform.getIdentifier());
        }
    }
}
