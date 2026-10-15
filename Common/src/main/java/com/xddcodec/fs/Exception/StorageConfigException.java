/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Exception;

import java.io.Serial;

public class StorageConfigException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 7993671808524980055L;

    public StorageConfigException() {
        super();
    }

    public StorageConfigException(ErrorMessages error) {
        super(error.getKey());
    }

    public StorageConfigException(ErrorMessages error, Throwable cause) {
        super(error.getKey(), cause);
    }

    public StorageConfigException(String message) {
        super(message);
    }

    public StorageConfigException(String message, Throwable cause) {
        super(message, cause);
    }
}
