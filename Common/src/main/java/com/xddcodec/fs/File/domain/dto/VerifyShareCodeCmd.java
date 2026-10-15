/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyShareCodeCmd {

    @NotBlank(message = "分享ID不能为空")
    private String shareId;

    @NotBlank(message = "分享验证码不能为空")
    private String shareCode;
}
