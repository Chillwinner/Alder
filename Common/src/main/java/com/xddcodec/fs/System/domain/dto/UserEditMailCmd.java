/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 修改邮箱命令
 *
 * @Author: xddcode
 * @Date: 2024/12/4 9:25
 */
@Data
public class UserEditMailCmd {

    @NotBlank(message = "email不能为空")
    private String email;

    @NotBlank(message = "code不能为空")
    private String code;
}
