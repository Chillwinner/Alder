/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.ai.domain.vo.AiThreadVO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class AiThreadCatalog {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final long TTL_DAYS = 14;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public String indexKey(String workspaceId, String userId) {
        return indexKey(workspaceId, userId, null);
    }

    public String indexKey(String workspaceId, String userId, String scope) {
        String base = "ai:threads:" + workspaceId + ":" + userId;
        if (scope == null || scope.isBlank()) {
            return base;
        }
        return base + ":" + scope;
    }

    public String memoryId(String workspaceId, String userId, String threadId) {
        return workspaceId + ":" + userId + ":" + threadId;
    }

    public List<AiThreadVO> list(String workspaceId, String userId) {
        return list(workspaceId, userId, null);
    }

    public List<AiThreadVO> list(String workspaceId, String userId, String scope) {
        Map<Object, Object> raw = redis.opsForHash().entries(indexKey(workspaceId, userId, scope));
        List<AiThreadVO> out = new ArrayList<>();
        raw.forEach((id, json) -> {
            try {
                Map<String, Object> map = objectMapper.readValue(String.valueOf(json), MAP);
                AiThreadVO vo = new AiThreadVO();
                vo.setId(String.valueOf(id));
                vo.setTitle(String.valueOf(map.getOrDefault("title", "")));
                Object updated = map.get("updatedAt");
                vo.setUpdatedAt(updated instanceof Number n ? n.longValue() : 0L);
                out.add(vo);
            } catch (Exception ignored) {
                // skip corrupt field
            }
        });
        out.sort(Comparator.comparing(AiThreadVO::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    public AiThreadVO create(String workspaceId, String userId) {
        return create(workspaceId, userId, null);
    }

    public AiThreadVO create(String workspaceId, String userId, String scope) {
        String id = UUID.randomUUID().toString().replace("-", "");
        AiThreadVO vo = new AiThreadVO();
        vo.setId(id);
        vo.setTitle("");
        vo.setUpdatedAt(System.currentTimeMillis());
        save(workspaceId, userId, vo, scope);
        return vo;
    }

    public void touch(String workspaceId, String userId, String threadId, String titleIfEmpty) {
        touch(workspaceId, userId, threadId, titleIfEmpty, null);
    }

    public void touch(String workspaceId, String userId, String threadId, String titleIfEmpty, String scope) {
        AiThreadVO existing = list(workspaceId, userId, scope).stream()
                .filter(item -> item.getId().equals(threadId))
                .findFirst()
                .orElse(null);
        if (existing == null) {
            existing = new AiThreadVO();
            existing.setId(threadId);
            existing.setTitle("");
        }
        if ((existing.getTitle() == null || existing.getTitle().isBlank())
                && titleIfEmpty != null
                && !titleIfEmpty.isBlank()) {
            existing.setTitle(titleIfEmpty.length() > 24 ? titleIfEmpty.substring(0, 24) : titleIfEmpty);
        }
        existing.setUpdatedAt(System.currentTimeMillis());
        save(workspaceId, userId, existing, scope);
    }

    public void delete(String workspaceId, String userId, String threadId) {
        delete(workspaceId, userId, threadId, null);
    }

    public void delete(String workspaceId, String userId, String threadId, String scope) {
        redis.opsForHash().delete(indexKey(workspaceId, userId, scope), threadId);
    }

    private void save(String workspaceId, String userId, AiThreadVO vo, String scope) {
        try {
            String key = indexKey(workspaceId, userId, scope);
            redis.opsForHash().put(key, vo.getId(), objectMapper.writeValueAsString(Map.of(
                    "title", vo.getTitle() == null ? "" : vo.getTitle(),
                    "updatedAt", vo.getUpdatedAt() == null ? 0L : vo.getUpdatedAt()
            )));
            redis.expire(key, TTL_DAYS, TimeUnit.DAYS);
        } catch (Exception e) {
            throw new IllegalStateException("无法写入对话目录", e);
        }
    }
}
