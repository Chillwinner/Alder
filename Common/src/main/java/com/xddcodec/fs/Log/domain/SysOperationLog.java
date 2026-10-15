/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Log.domain;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 工作空间操作日志。
 */
@Data
public class SysOperationLog implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private String operatorId;

    private String operatorName;

    private String workspaceId;

    private String operationType;

    private String operationName;

    private String targetType;

    private String targetId;

    private String targetName;

    private String detail;

    private String operationIp;

    private String userAgent;

    /**
     * 0 成功，1 失败。
     */
    private Integer status;

    private String errorMessage;

    private LocalDateTime operationTime;
}
