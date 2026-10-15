/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Log.domain.dto;

import com.xddcodec.fs.Framework.common.domain.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 操作日志分页查询。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class OperationLogPageQry extends PageQuery {

    private String keyword;

    private String operationType;

    private Integer status;
}
