/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.mapper;

import com.xddcodec.fs.Log.domain.SysOperationLog;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 操作日志 Mapper。
 */
public interface SysOperationLogMapper {
    int insert(SysOperationLog row);


    List<SysOperationLog> selectPage(@Param("workspaceId") String workspaceId,
                                     @Param("keyword") String keyword,
                                     @Param("operationType") String operationType,
                                     @Param("status") Integer status);
}
