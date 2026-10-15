/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.office;

import com.xddcodec.fs.Exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileWriteLockService {

    public static final Duration TTL = Duration.ofMinutes(15);

    private final StringRedisTemplate redis;

    public record Hold(String fileId, String userId, String sessionId) {
    }

    private static String key(String fileId) {
        return "fs:file:write:" + fileId;
    }

    public Hold acquire(String fileId, String userId) {
        String sessionId = UUID.randomUUID().toString().replace("-", "");
        String value = userId + ":" + sessionId;
        Boolean ok = redis.opsForValue().setIfAbsent(key(fileId), value, TTL);
        if (Boolean.TRUE.equals(ok)) {
            return new Hold(fileId, userId, sessionId);
        }
        Hold current = peek(fileId);
        if (current != null && userId.equals(current.userId())) {
            redis.expire(key(fileId), TTL);
            return current;
        }
        throw new BusinessException("该文件正在被其他人用 AI 修改");
    }

    public void heartbeat(String fileId, String userId, String sessionId) {
        Hold current = requireMine(fileId, userId, sessionId);
        redis.expire(key(current.fileId()), TTL);
    }

    public void release(String fileId, String userId, String sessionId) {
        Hold current = peek(fileId);
        if (current == null) {
            return;
        }
        if (userId.equals(current.userId()) && sessionId.equals(current.sessionId())) {
            redis.delete(key(fileId));
        }
    }

    public Hold peek(String fileId) {
        String raw = redis.opsForValue().get(key(fileId));
        if (StringUtils.isBlank(raw)) {
            return null;
        }
        int split = raw.indexOf(':');
        if (split <= 0) {
            return null;
        }
        return new Hold(fileId, raw.substring(0, split), raw.substring(split + 1));
    }

    public Hold requireMine(String fileId, String userId, String sessionId) {
        Hold current = peek(fileId);
        if (current == null
                || !userId.equals(current.userId())
                || !sessionId.equals(current.sessionId())) {
            throw new BusinessException("没有这份文件的写锁");
        }
        return current;
    }
}
