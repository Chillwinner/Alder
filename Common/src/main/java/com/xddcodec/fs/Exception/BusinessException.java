/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Exception;

import java.io.Serial;

public class BusinessException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 5450935008012318697L;

    private final Integer code;

    public BusinessException() {
        super();
        this.code = 500;
    }

    public BusinessException(ErrorMessages error) {
        super(error.getKey());
        this.code = error.getCode();
    }

    public BusinessException(Integer code) {
        super();
        this.code = code == null ? 500 : code;
    }

    public BusinessException(String message) {
        super(message);
        this.code = 500;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code == null ? 500 : code;
    }

    public Integer getCode() {
        return code;
    }

    public String getMessage() {
        String message = super.getMessage();
        return message == null ? "" : message;
    }
}
