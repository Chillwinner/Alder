/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Storage.domain.cmd;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class StorageSettingEditCmd {

    @NotBlank(message = "settingId不能为空")
    private String settingId;

    @NotBlank(message = "platformIdentifier不能为空")
    private String platformIdentifier;

    @NotBlank(message = "configData不能为空")
    private String configData;

    private String remark;
}
