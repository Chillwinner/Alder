/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * 移动文件DTO
 *
 * @Author: xddcode
 * @Date: 2025/5/13 8:41
 */
@Data
public class MoveFileCmd {

    private String dirId;

    @NotEmpty(message = "请选择要移动的文件")
    private List<String> fileIds;
}
