/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserTransferSettingEditCmd {

    @NotBlank(message = "文件下载位置不能为空")
    private String downloadLocation;

    @NotNull(message = "")
    @Min(value = 0)
    @Max(value = 1)
    private Integer isDefaultDownloadLocation;

    @NotNull(message = "下载速率限制不能为空")
    @Max(value = 200, message = "下载速率最大不能超过200 MB/S")
    private Integer downloadSpeedLimit;

    @NotNull(message = "上传并发数不能为空")
    @Max(value = 3, message = "上传并发数不能超过3")
    private Integer concurrentUploadQuantity;

    @NotNull(message = "下载并发数不能为空")
    @Max(value = 3, message = "下载并发数不能超过3")
    private Integer concurrentDownloadQuantity;

    @NotNull(message = "分片大小不能为空")
    private Long chunkSize;
}
