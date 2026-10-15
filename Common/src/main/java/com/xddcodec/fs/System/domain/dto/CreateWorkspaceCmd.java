/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 创建工作空间命令对象
 *
 * @Author: xddcode
 * @Date: 2026/31 11:24
 */
@Data
public class CreateWorkspaceCmd {

    @NotBlank(message = "工作空间名称不能为空")
    private String name;

    @NotBlank(message = "工作空间标识不能为空")
    private String slug;

    private String description;

}
