/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
public class HostLoadVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 0–1，本机 CPU 占用 */
    private double cpu;

    /** 0–1，本机物理内存占用 */
    private double memory;

    private long memoryUsedBytes;

    private long memoryTotalBytes;
}
