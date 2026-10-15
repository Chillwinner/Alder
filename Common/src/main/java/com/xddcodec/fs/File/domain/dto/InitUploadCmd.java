/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InitUploadCmd {

    @NotBlank(message = "文件名不能为空")
    private String fileName;

    @NotNull(message = "文件大小不能为空")
    private Long fileSize;

    private String parentId;

    @NotNull(message = "分片总数不能为空")
    private Integer totalChunks;

    @NotNull(message = "分片大小不能为空")
    private Long chunkSize;

    @NotBlank(message = "MIME类型不能为空")
    private String mimeType;

    /**
     * 目标目录已有同名同后缀文件时，是否改成「名字 (1).后缀」
     */
    private Boolean allowRename;
}
