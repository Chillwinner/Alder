/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Context;

import com.alibaba.ttl.TransmittableThreadLocal;

public class UserContext {

    private static final TransmittableThreadLocal<String> USER_ID =
            new TransmittableThreadLocal<String>();

    public static void setUserId(String userId) {
        USER_ID.set(userId);
    }

    public static String getUserId() {
        return USER_ID.get();
    }

    public static void clear() {
        USER_ID.remove();
    }
}
