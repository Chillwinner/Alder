/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@Component
@RequiredArgsConstructor
public class MemoBoardSseHub {

    private final ObjectMapper objectMapper;
    private final Map<String, Set<SseEmitter>> workspaceEmitters = new ConcurrentHashMap<>();
    private final Executor dispatch = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "memo-board-sse");
        t.setDaemon(true);
        return t;
    });

    public SseEmitter subscribe(String workspaceId, String userId) {
        SseEmitter emitter = new SseEmitter(0L);
        workspaceEmitters.computeIfAbsent(workspaceId, k -> new CopyOnWriteArraySet<>()).add(emitter);
        emitter.onCompletion(() -> remove(workspaceId, emitter));
        emitter.onTimeout(() -> remove(workspaceId, emitter));
        emitter.onError(e -> remove(workspaceId, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove(workspaceId, emitter);
        }
        return emitter;
    }

    public void dispatch(Runnable action) {
        dispatch.execute(() -> {
            try {
                action.run();
            } catch (Exception ignored) {
            }
        });
    }

    public void broadcast(String workspaceId, Object payload) {
        Set<SseEmitter> emitters = workspaceEmitters.get(workspaceId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("memo").data(json));
            } catch (Exception e) {
                remove(workspaceId, emitter);
            }
        }
    }

    private void remove(String workspaceId, SseEmitter emitter) {
        Set<SseEmitter> set = workspaceEmitters.get(workspaceId);
        if (set != null) {
            set.remove(emitter);
        }
        try {
            emitter.complete();
        } catch (Exception ignored) {
        }
    }
}
