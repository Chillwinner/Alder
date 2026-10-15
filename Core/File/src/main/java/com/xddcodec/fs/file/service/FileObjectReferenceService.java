/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.Context.WorkspaceContext;

import cn.hutool.core.util.StrUtil;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * 物理存储对象引用协调服务。
 * file_info 是引用关系的唯一事实来源，不维护容易失真的独立引用计数。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileObjectReferenceService {

    private static final String LOCK_PREFIX = "file:object-reference:lock:";
    private static final long LOCK_EXPIRE_SECONDS = 60;
    private static final long LOCK_WAIT_MILLIS = 10_000;
    private static final long LOCK_RETRY_MILLIS = 50;
    private static final DefaultRedisScript<Long> COMPARE_AND_DELETE = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class);

    private final FileInfoMapper fileInfoMapper;
    private final StorageServiceFacade storageServiceFacade;
    private final StringRedisTemplate redis;

    /**
     * 在同一物理存储配置中查找内容相同且对象仍真实存在的文件。
     * 回收站记录仍可恢复，因此同样属于有效引用。
     */
    public FileInfo findReusableFile(String contentMd5, Long size, String storageSettingId) {
        if (StrUtil.isBlank(contentMd5)) {
            return null;
        }

        for (FileInfo candidate : fileInfoMapper.selectReusableByContent(contentMd5, size, storageSettingId)) {
            try {
                IStorageOperationService storageService = WorkspaceContext.callIn(
                        candidate.getWorkspaceId(),
                        () -> storageServiceFacade.getStorageService(candidate.getStoragePlatformSettingId()));
                if (storageService.isFileExist(candidate.getObjectKey())) {
                    return candidate;
                }
                log.warn("去重候选对象不存在，保留文件记录并跳过: fileId={}, objectKey={}",
                        candidate.getId(), candidate.getObjectKey());
            } catch (Exception e) {
                log.warn("检查去重候选对象失败，跳过本次候选: fileId={}, objectKey={}",
                        candidate.getId(), candidate.getObjectKey(), e);
            }
        }
        return null;
    }

    /**
     * 数据库中是否仍有任意用户记录引用该物理对象（包括回收站记录）。
     */
    public boolean hasReferences(FileInfo file) {
        if (file == null || StrUtil.isBlank(file.getObjectKey())) {
            return false;
        }
        return fileInfoMapper.countByObjectKey(file.getObjectKey(), file.getStoragePlatformSettingId()) > 0;
    }

    /**
     * 仅在确认没有任何引用时删除物理对象。
     */
    public void deletePhysicalFileIfUnreferenced(FileInfo file) {
        if (file == null || StrUtil.isBlank(file.getObjectKey()) || hasReferences(file)) {
            return;
        }
        WorkspaceContext.runIn(file.getWorkspaceId(), () -> {
            IStorageOperationService storageService =
                    storageServiceFacade.getStorageService(file.getStoragePlatformSettingId());
            storageService.deleteFile(file.getObjectKey());
        });
        log.info("最后一个引用已删除，清理物理对象: objectKey={}", file.getObjectKey());
    }

    /**
     * 永久删除数据库记录提交后调用。逐个对象加锁并重新计数，避免与并发秒传互相干扰。
     */
    public void deletePhysicalFileIfUnreferencedWithLock(FileInfo file) {
        try (ReferenceLock contentLock = acquireContentLock(
                file.getStoragePlatformSettingId(), file.getContentMd5(), file.getSize());
             ReferenceLock objectLock = acquireObjectLock(
                     file.getStoragePlatformSettingId(), file.getObjectKey())) {
            deletePhysicalFileIfUnreferenced(file);
        }
    }

    public ReferenceLock acquireContentLock(String storageSettingId, String contentMd5, Long size) {
        if (StrUtil.isBlank(contentMd5)) {
            return ReferenceLock.noop();
        }
        return acquireLock("content:" + storageKey(storageSettingId) + ":" + contentMd5 + ":" + size);
    }

    public ReferenceLock acquireObjectLock(String storageSettingId, String objectKey) {
        if (StrUtil.isBlank(objectKey)) {
            return ReferenceLock.noop();
        }
        return acquireLock("object:" + storageKey(storageSettingId) + ":" + objectKey);
    }

    private ReferenceLock acquireLock(String lockName) {
        String key = LOCK_PREFIX + lockName;
        String token = UUID.randomUUID().toString();
        long deadline = System.currentTimeMillis() + LOCK_WAIT_MILLIS;

        while (System.currentTimeMillis() < deadline) {
            Boolean locked = redis.opsForValue().setIfAbsent(key, token, Duration.ofSeconds(LOCK_EXPIRE_SECONDS));
            if (Boolean.TRUE.equals(locked)) {
                return new ReferenceLock(redis, key, token);
            }
            try {
                Thread.sleep(LOCK_RETRY_MILLIS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException(ErrorMessages.FILE_OBJECT_BUSY);
            }
        }
        throw new BusinessException(ErrorMessages.FILE_OBJECT_BUSY);
    }

    private String storageKey(String storageSettingId) {
        return StrUtil.isBlank(storageSettingId) ? "local" : storageSettingId;
    }

    public static final class ReferenceLock implements AutoCloseable {
        private final StringRedisTemplate redis;
        private final String key;
        private final String token;
        private boolean closed;

        private ReferenceLock(StringRedisTemplate redis, String key, String token) {
            this.redis = redis;
            this.key = key;
            this.token = token;
        }

        private ReferenceLock() {
            this.redis = null;
            this.key = null;
            this.token = null;
            this.closed = true;
        }

        private static ReferenceLock noop() {
            return new ReferenceLock();
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }
            closed = true;
            Long deleted = redis.execute(COMPARE_AND_DELETE, List.of(key), token);
            if (deleted == null || deleted == 0) {
                log.warn("物理对象引用锁释放失败或已过期: key={}", key);
            }
        }
    }
}
