/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.office;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 工具执行不保证还在请求线程上，用 memoryId 查共享表，而不是线程局部变量。
 */
public final class OfficeEditScope {

    private static final ConcurrentHashMap<String, Turn> TURNS = new ConcurrentHashMap<>();

    private OfficeEditScope() {
    }

    public static void bind(String memoryId, String fileId, String sessionId) {
        TURNS.put(memoryId, new Turn(fileId, sessionId, new AtomicInteger(), new StringBuilder()));
    }

    public static String fileId(String memoryId) {
        Turn turn = TURNS.get(memoryId);
        return turn == null ? null : turn.fileId;
    }

    public static String sessionId(String memoryId) {
        Turn turn = TURNS.get(memoryId);
        return turn == null ? null : turn.sessionId;
    }

    /** 同一轮只允许查看一次。 */
    public static boolean allowInspect(String memoryId) {
        Turn turn = TURNS.get(memoryId);
        if (turn == null) {
            return false;
        }
        return turn.inspects.incrementAndGet() == 1;
    }

    public static void noteTool(String memoryId, String text) {
        Turn turn = TURNS.get(memoryId);
        if (turn == null || text == null) {
            return;
        }
        turn.lastTool.setLength(0);
        turn.lastTool.append(text);
    }

    public static String lastTool(String memoryId) {
        Turn turn = TURNS.get(memoryId);
        return turn == null ? "" : turn.lastTool.toString();
    }

    public static void clear(String memoryId) {
        if (memoryId != null) {
            TURNS.remove(memoryId);
        }
    }

    private record Turn(String fileId, String sessionId, AtomicInteger inspects, StringBuilder lastTool) {
    }
}
