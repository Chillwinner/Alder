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
 * 分享访问记录表
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
@Data
public class FileShareAccessRecord implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 分享ID
     */
    private String id;

    /**
     * 分享ID
     */
    private String shareId;

    /**
     * 访问IP
     */
    private String accessIp;

    /**
     * 访问地址
     */
    private String accessAddress;

    /**
     * 访问浏览器
     */
    private String browser;

    /**
     * 访问操作系统
     */
    private String os;

    /**
     * 访问时间
     */
    private LocalDateTime accessTime;
}
