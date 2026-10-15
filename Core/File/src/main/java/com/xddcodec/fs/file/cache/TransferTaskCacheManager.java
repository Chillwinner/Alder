/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.cache;

import com.xddcodec.fs.File.domain.FileTransferTask;
import com.xddcodec.fs.File.enums.TransferTaskStatus;
import com.xddcodec.fs.common.utils.JsonUtils;
import com.xddcodec.fs.Sse.dto.CompleteEventDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class TransferTaskCacheManager {

    private static final String TASK_PREFIX = "transfer:task:";
    private static final String CHUNKS_PREFIX = "transfer:chunks:";
    private static final String BYTES_PREFIX = "transfer:bytes:";
    private static final String START_TIME_PREFIX = "transfer:startTime:";
    private static final Duration TASK_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redis;

    public void cacheTask(FileTransferTask task) {
        if (task == null || task.getTaskId() == null) {
            log.warn("缓存任务参数无效");
            return;
        }
        Integer realCount = getTransferredChunks(task.getTaskId());
        task.setUploadedChunks(realCount);
        task.setUpdatedAt(LocalDateTime.now());
        redis.opsForValue().set(TASK_PREFIX + task.getTaskId(), JsonUtils.toJsonString(task), TASK_TTL);
    }

    public FileTransferTask getTaskFromCache(String taskId) {
        String json = redis.opsForValue().get(TASK_PREFIX + taskId);
        return json == null ? null : JsonUtils.parseObject(json, FileTransferTask.class);
    }

    public Integer getTransferredChunks(String taskId) {
        Long size = redis.opsForHash().size(CHUNKS_PREFIX + taskId);
        return size != null ? size.intValue() : 0;
    }

    public void addTransferredChunk(String taskId, Integer chunkIndex, String etag) {
        String key = CHUNKS_PREFIX + taskId;
        redis.opsForHash().put(key, String.valueOf(chunkIndex), etag);
        redis.expire(key, TASK_TTL);
    }

    public Map<Integer, String> getTransferredChunkList(String taskId) {
        Map<Object, Object> entries = redis.opsForHash().entries(CHUNKS_PREFIX + taskId);
        if (entries == null || entries.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Integer, String> result = new TreeMap<>();
        for (Map.Entry<Object, Object> entry : entries.entrySet()) {
            result.put(Integer.parseInt(entry.getKey().toString()), String.valueOf(entry.getValue()));
        }
        return result;
    }

    public boolean isChunkTransferred(String taskId, Integer chunkIndex) {
        return Boolean.TRUE.equals(redis.opsForHash().hasKey(CHUNKS_PREFIX + taskId, String.valueOf(chunkIndex)));
    }

    public boolean isAllChunksTransferred(String taskId, Integer totalChunks) {
        return getTransferredChunks(taskId).equals(totalChunks);
    }

    public void recordTransferredBytes(String taskId, long bytes) {
        String key = BYTES_PREFIX + taskId;
        redis.opsForValue().increment(key, bytes);
        redis.expire(key, TASK_TTL);
    }

    public void setTransferredBytes(String taskId, long bytes) {
        String key = BYTES_PREFIX + taskId;
        redis.opsForValue().set(key, String.valueOf(Math.max(bytes, 0)), TASK_TTL);
    }

    public long getTransferredBytes(String taskId) {
        String value = redis.opsForValue().get(BYTES_PREFIX + taskId);
        return value != null ? Long.parseLong(value) : 0;
    }

    public void recordStartTime(String taskId) {
        redis.opsForValue().set(START_TIME_PREFIX + taskId, String.valueOf(System.currentTimeMillis()), TASK_TTL);
    }

    public Long getStartTime(String taskId) {
        String value = redis.opsForValue().get(START_TIME_PREFIX + taskId);
        return value != null ? Long.parseLong(value) : null;
    }

    public void updateTaskStatus(String taskId, TransferTaskStatus status) {
        FileTransferTask task = getTaskFromCache(taskId);
        if (task == null) {
            return;
        }
        task.setStatus(status);
        cacheTask(task);
    }

    public void updateTaskCompleteTime(String taskId, LocalDateTime completeTime) {
        FileTransferTask task = getTaskFromCache(taskId);
        if (task == null) {
            return;
        }
        task.setCompleteTime(completeTime);
        task.setStatus(TransferTaskStatus.completed);
        cacheTask(task);
    }

    public void cleanTask(String taskId) {
        redis.delete(List.of(
                TASK_PREFIX + taskId,
                CHUNKS_PREFIX + taskId,
                BYTES_PREFIX + taskId,
                START_TIME_PREFIX + taskId,
                "download:chunks:" + taskId
        ));
    }

    public void cleanTasks(List<String> taskIds) {
        taskIds.forEach(this::cleanTask);
    }

    public void extendTaskExpire(String taskId, long days) {
        Duration ttl = Duration.ofDays(days);
        redis.expire(TASK_PREFIX + taskId, ttl);
        redis.expire(CHUNKS_PREFIX + taskId, ttl);
        redis.expire(BYTES_PREFIX + taskId, ttl);
        redis.expire(START_TIME_PREFIX + taskId, ttl);
    }

    public boolean sHasKey(String key, Object value) {
        return Boolean.TRUE.equals(redis.opsForSet().isMember(key, String.valueOf(value)));
    }

    public Long sSetAndTime(String key, long time, Object... values) {
        String[] members = new String[values.length];
        for (int i = 0; i < values.length; i++) {
            members[i] = String.valueOf(values[i]);
        }
        Long count = redis.opsForSet().add(key, members);
        if (time > 0) {
            redis.expire(key, Duration.ofSeconds(time));
        }
        return count;
    }

    public Long sGetSetSize(String key) {
        Long size = redis.opsForSet().size(key);
        return size != null ? size : 0L;
    }

    public Set<Object> sGet(String key) {
        Set<String> members = redis.opsForSet().members(key);
        if (members == null) {
            return Collections.emptySet();
        }
        return members.stream().map(s -> (Object) s).collect(Collectors.toSet());
    }

    public void deleteKey(String key) {
        redis.delete(key);
    }

    public boolean tryLock(String lockKey, long expireSeconds) {
        return Boolean.TRUE.equals(
                redis.opsForValue().setIfAbsent(lockKey, "locked", Duration.ofSeconds(expireSeconds)));
    }

    public void releaseLock(String lockKey) {
        redis.delete(lockKey);
    }

    public void cacheCompleteEvent(String taskId, Object completeData) {
        redis.opsForValue().set(
                "transfer:complete:" + taskId,
                JsonUtils.toJsonString(completeData),
                TASK_TTL
        );
    }

    public Object getAndRemoveCompleteEvent(String taskId) {
        String key = "transfer:complete:" + taskId;
        String json = redis.opsForValue().get(key);
        if (json == null) {
            return null;
        }
        redis.delete(key);
        return JsonUtils.parseObject(json, CompleteEventDTO.class);
    }
}
