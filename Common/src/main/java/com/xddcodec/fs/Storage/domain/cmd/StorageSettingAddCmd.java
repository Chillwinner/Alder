/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Storage.domain.cmd;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StorageSettingAddCmd {

    @NotBlank(message = "platformIdentifier不能为空")
    private String platformIdentifier;

    @NotBlank(message = "configData不能为空")
    private String configData;

    private String remark;
}
