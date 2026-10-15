/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileTransferTask;
import lombok.Data;

@Data
public class UploadInitVO {
    /**
     * 是否秒传
     */
    private Boolean instant;

    /**
     * 秒传时返回文件信息
     */
    private FileInfo fileInfo;

    /**
     * 需要上传时返回任务信息
     */
    private FileTransferTask task;

    /**
     * 提示信息
     */
    private String message;
}
