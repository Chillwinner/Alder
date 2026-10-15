/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.xddcodec.fs.File.domain.FileShareAccessRecord;
import com.xddcodec.fs.Framework.common.utils.DateUtils;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@AutoMapper(target = FileShareAccessRecord.class)
public class FileShareAccessRecordVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 自增ID
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
    @JsonFormat(pattern = DateUtils.DATE_TIME_PATTERN)
    private LocalDateTime accessTime;
}
