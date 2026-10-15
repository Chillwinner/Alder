/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveShareToWorkspaceCmd {

    private String shareId;

    @NotBlank
    private String fileId;

    /**
     * 目标目录 ID，空表示工作空间根目录。
     */
    private String parentId;
}
