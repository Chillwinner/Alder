/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Exception;

import java.io.Serial;

public class StorageOperationException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = -29314971002267476L;

    public StorageOperationException(ErrorMessages error) {
        super(error.getKey());
    }

    public StorageOperationException(ErrorMessages error, Throwable cause) {
        super(error.getKey(), cause);
    }

    public StorageOperationException(String message) {
        super(message);
    }

    public StorageOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
