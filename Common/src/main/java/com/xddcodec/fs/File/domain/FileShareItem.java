/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 分享文件关联实体类
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
@Data
public class FileShareItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 分享ID
     */
    private String shareId;

    /**
     * 文件/文件夹ID
     */
    private String fileId;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
}
