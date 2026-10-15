/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Result;

import com.xddcodec.fs.Exception.ErrorMessages;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private T data;

    private Integer code;

    private String msg = "success";

    public static <T> Result<T> ok() {
        return of(null, 200, "ok");
    }

    public static <T> Result<T> ok(T model) {
        return of(model, 200, "ok");
    }

    public static <T> Result<T> ok(T datas, String msg) {
        return of(datas, 200, msg);
    }

    private static <T> Result<T> of(T data, Integer code, String msg) {
        return new Result<>(data, code, msg);
    }

    public static <T> Result<T> error(ErrorMessages error) {
        return of(null, error.getCode(), error.getKey());
    }

    public static <T> Result<T> error(Integer code) {
        return of(null, code, "");
    }

    public static <T> Result<T> error(String msg) {
        return of(null, 500, msg);
    }

    public static <T> Result<T> error(Integer code, String msg) {
        return of(null, code, msg);
    }

    public static <T> Result<T> error(T datas, String msg) {
        return of(datas, 500, msg);
    }

    public static <T> Result<T> error(Integer code, String msg, T datas) {
        return of(datas, code, msg);
    }
}
