/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.service;

import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.Log.domain.dto.OperationLogPageQry;
import com.xddcodec.fs.Log.domain.vo.SysOperationLogVO;

/**
 * 操作日志服务。
 */
public interface SysOperationLogService {

    PageResult<SysOperationLogVO> getPages(OperationLogPageQry qry);

    void recordSuccess(String operationType,
                       String operationName,
                       String targetType,
                       String targetId,
                       String targetName,
                       String detail);

    void recordSuccess(String workspaceId,
                       String operationType,
                       String operationName,
                       String targetType,
                       String targetId,
                       String targetName,
                       String detail);

    void recordSuccessAs(String workspaceId,
                         String operatorId,
                         String operatorName,
                         String operationType,
                         String operationName,
                         String targetType,
                         String targetId,
                         String targetName,
                         String detail);

    void recordFailure(String operationType,
                       String operationName,
                       String targetType,
                       String targetId,
                       String targetName,
                       String detail,
                       String errorMessage);
}
