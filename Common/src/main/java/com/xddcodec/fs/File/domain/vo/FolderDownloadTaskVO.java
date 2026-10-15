/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;

@Data
public class FolderDownloadTaskVO {
    private String taskId;
    private String folderId;
    private String folderName;
    private String status;
    private Integer progress;
    private Integer totalFiles;
    private Integer processedFiles;
    private Long totalBytes;
    private Long processedBytes;
    private Long zipSize;
    private String message;
    private String errorMessage;
}
