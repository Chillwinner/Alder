/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
public class UpdateUserStatusCmd implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @NotNull(message = "状态不能为空")
    private Integer status;
}
