/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.support;

public final class BoardConstants {

    private BoardConstants() {
    }

    public static final String REDIS_MEMO_STATE_PREFIX = "board:memo:";
    public static final String REDIS_MEMO_STATE_SUFFIX = ":yjs";
    public static final String REDIS_MEMO_DIRTY_SUFFIX = ":dirty";
    public static final String REDIS_MEMO_ACTIVE_SUFFIX = ":active";
    public static final String REDIS_CHANNEL = "board:memo:sync";

    public static String memoTopic(String memoId) {
        return "/topic/memo." + memoId;
    }

    public static String userPrincipal(String userId) {
        return "u:" + userId;
    }
}
