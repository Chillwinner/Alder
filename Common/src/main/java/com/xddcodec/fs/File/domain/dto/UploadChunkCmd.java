/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.dto;

import lombok.Data;

@Data
public class UploadChunkCmd {
    private String taskId;
    private Integer chunkIndex;
    private String chunkMd5;
}
