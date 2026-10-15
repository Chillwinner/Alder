/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.schedule;

import com.xddcodec.fs.workspaceboard.service.MemoPersistenceService;
import com.xddcodec.fs.workspaceboard.support.BoardConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class MemoPersistenceScheduler {

    private final StringRedisTemplate redis;
    private final MemoPersistenceService persistenceService;

    @Scheduled(fixedDelay = 30_000)
    public void flushDirtyMemos() {
        String prefix = BoardConstants.REDIS_MEMO_STATE_PREFIX;
        String dirtySuffix = BoardConstants.REDIS_MEMO_DIRTY_SUFFIX;
        Set<String> keys = redis.keys(prefix + "*" + dirtySuffix);
        if (keys == null || keys.isEmpty()) {
            return;
        }
        persistenceService.flushDirtyMemos(keys.stream()
                .filter(key -> key.startsWith(prefix) && key.endsWith(dirtySuffix))
                .map(key -> key.substring(prefix.length(), key.length() - dirtySuffix.length()))
                .collect(Collectors.toSet()));
    }
}
