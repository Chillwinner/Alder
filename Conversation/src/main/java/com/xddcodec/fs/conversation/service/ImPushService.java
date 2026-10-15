/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.conversation.domain.dto.ImPush;
import com.xddcodec.fs.conversation.support.ImConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ImPushService {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public void publish(ImPush push) {
        try {
            stringRedisTemplate.convertAndSend(ImConstants.CHANNEL, objectMapper.writeValueAsString(push));
        } catch (Exception ignored) {
            // push is best-effort; history remains in PG
        }
    }
}
