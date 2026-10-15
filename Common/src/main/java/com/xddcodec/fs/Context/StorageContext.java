/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Context;

import com.alibaba.ttl.TransmittableThreadLocal;

public class StorageContext {

    private static final TransmittableThreadLocal<String> CONFIG_ID =
            new TransmittableThreadLocal<String>();

    public static void setConfigId(String configId) {
        CONFIG_ID.set(configId);
    }

    public static String getConfigId() {
        return CONFIG_ID.get();
    }

    public static void clear() {
        CONFIG_ID.remove();
    }
}
