/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CheckUploadCmd {

    @NotBlank(message = "taskId不能为空")
    private String taskId;

    @NotBlank(message = "fileMd5不能为空")
    private String fileMd5;

    private String fileName;
}
