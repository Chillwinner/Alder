/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 更新工作空间命令
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Data
public class UpdateWorkspaceCmd implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 工作空间名称
     */
    @NotBlank(message = "工作空间名称不能为空")
    private String name;

    /**
     * 描述
     */
    private String description;

    /**
     * 本地目录配额，单位 GB；空则不改
     */
    private Double localQuotaGb;
}
