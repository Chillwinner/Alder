/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.xddcodec.fs.File.enums.FileCollectionStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FileCollectionPublicVO {
    private String id;
    private String collectionName;
    private String description;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime expireTime;
    private Boolean expired;
    private Boolean hasAccessCode;
    private Long maxFileSize;
    private String allowedExtensions;
    private FileCollectionStatus status;
}
