/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Context;

import com.alibaba.ttl.TransmittableThreadLocal;

import java.util.function.Supplier;

public class WorkspaceContext {

    private static final TransmittableThreadLocal<String> WORKSPACE_ID =
            new TransmittableThreadLocal<String>();

    public static void setWorkspaceId(String workspaceId) {
        WORKSPACE_ID.set(workspaceId);
    }

    public static String getWorkspaceId() {
        return WORKSPACE_ID.get();
    }

    public static void clear() {
        WORKSPACE_ID.remove();
    }

    public static <T> T callIn(String workspaceId, Supplier<T> action) {
        String previous = getWorkspaceId();
        try {
            setWorkspaceId(workspaceId);
            return action.get();
        } finally {
            if (previous == null) {
                clear();
            } else {
                setWorkspaceId(previous);
            }
        }
    }

    public static void runIn(String workspaceId, Runnable action) {
        callIn(workspaceId, () -> {
            action.run();
            return null;
        });
    }
}
