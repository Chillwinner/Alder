/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.xddcodec.fs.File.enums.FileCollectionSubmissionStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FileCollectionSubmissionVO {
    private String id;
    private String submitterName;
    private String submitterIp;
    private String folderId;
    private Integer fileCount;
    private Long totalSize;
    private FileCollectionSubmissionStatus status;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime completedAt;
}
