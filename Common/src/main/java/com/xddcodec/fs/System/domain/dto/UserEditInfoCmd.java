/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

/**
 * @Author: xddcode
 * @Date: 2024/12/4 9:25
 */
@Data
public class UserEditInfoCmd {

    @NotBlank(message = "nickname不能为空")
    private String nickname;
}
