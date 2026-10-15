/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateFileCollectionSubmissionCmd {

    @NotBlank(message = "提交人姓名不能为空")
    @Size(max = 64, message = "提交人姓名不能超过64个字符")
    private String submitterName;

    @Size(max = 32, message = "访问码不能超过32个字符")
    private String accessCode;
}
