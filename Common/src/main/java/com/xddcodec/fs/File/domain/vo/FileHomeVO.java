/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

@Data
public class FileHomeVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Double usedStorage;

    private List<FileHomeUsedBytesVO> usedBytes;

    private List<FileVO> recentFiles;

    private String unit;

    /** 本地目录已用字节 */
    private Long localUsedBytes;

    /** 本地目录配额字节 */
    private Long localQuotaBytes;
}
