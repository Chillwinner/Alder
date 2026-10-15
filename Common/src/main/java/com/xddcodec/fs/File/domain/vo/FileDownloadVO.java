/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;
import org.springframework.core.io.Resource;

@Data
public class FileDownloadVO {
    private String fileName;
    private Long fileSize;
    private Resource resource;
}
