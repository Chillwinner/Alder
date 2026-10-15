/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.Context.UserContext;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserNotificationHiddenService {

    private static final String KEY_PREFIX = "user:notif-hidden:";

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public List<String> list() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        String raw = redis.opsForValue().get(KEY_PREFIX + userId);
        if (StringUtils.isBlank(raw)) {
            return List.of();
        }
        try {
            List<String> parsed = objectMapper.readValue(raw, new TypeReference<>() {});
            return parsed == null ? List.of() : parsed;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    public List<String> save(List<String> keys) {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (keys != null) {
            for (String key : keys) {
                if (StringUtils.isNotBlank(key)) {
                    unique.add(key.trim());
                }
            }
        }
        List<String> next = new ArrayList<>(unique);
        try {
            redis.opsForValue().set(KEY_PREFIX + userId, objectMapper.writeValueAsString(next));
        } catch (Exception ignored) {
        }
        return next;
    }
}
