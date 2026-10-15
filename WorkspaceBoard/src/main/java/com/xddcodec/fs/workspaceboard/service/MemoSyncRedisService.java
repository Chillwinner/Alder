/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.xddcodec.fs.workspaceboard.support.BoardConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class MemoSyncRedisService {

    private final StringRedisTemplate redis;

    public byte[] loadState(String memoId) {
        String encoded = redis.opsForValue().get(stateKey(memoId));
        return encoded == null || encoded.isEmpty() ? null : Base64.getDecoder().decode(encoded);
    }

    public void storeSnapshot(String memoId, byte[] state) {
        if (state == null || state.length == 0) {
            return;
        }
        redis.opsForValue().set(stateKey(memoId), Base64.getEncoder().encodeToString(state));
        markDirty(memoId);
    }

    public void markDirty(String memoId) {
        redis.opsForValue().set(dirtyKey(memoId), "1", Duration.ofHours(24));
    }

    public boolean isDirty(String memoId) {
        return Boolean.TRUE.equals(redis.hasKey(dirtyKey(memoId)));
    }

    public void clearDirty(String memoId) {
        redis.delete(dirtyKey(memoId));
    }

    public long incrementActive(String memoId) {
        Long v = redis.opsForValue().increment(activeKey(memoId));
        redis.expire(activeKey(memoId), Duration.ofHours(6));
        return v == null ? 0 : v;
    }

    public long decrementActive(String memoId) {
        Long v = redis.opsForValue().decrement(activeKey(memoId));
        if (v == null || v <= 0) {
            redis.delete(activeKey(memoId));
            return 0;
        }
        return v;
    }

    private String stateKey(String memoId) {
        return BoardConstants.REDIS_MEMO_STATE_PREFIX + memoId + BoardConstants.REDIS_MEMO_STATE_SUFFIX;
    }

    private String dirtyKey(String memoId) {
        return BoardConstants.REDIS_MEMO_STATE_PREFIX + memoId + BoardConstants.REDIS_MEMO_DIRTY_SUFFIX;
    }

    private String activeKey(String memoId) {
        return BoardConstants.REDIS_MEMO_STATE_PREFIX + memoId + BoardConstants.REDIS_MEMO_ACTIVE_SUFFIX;
    }
}
