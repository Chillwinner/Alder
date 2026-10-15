/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 重命名文件DTO
 *
 * @Author: xddcode
 * @Date: 2025/5/13 8:41
 */
@Data
public class RenameFileCmd {

    @NotBlank(message = "文件名称不能为空")
    private String displayName;
}
