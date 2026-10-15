/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import com.xddcodec.fs.File.enums.FileCollectionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateFileCollectionStatusCmd {

    @NotNull(message = "收集状态不能为空")
    private FileCollectionStatus status;
}
