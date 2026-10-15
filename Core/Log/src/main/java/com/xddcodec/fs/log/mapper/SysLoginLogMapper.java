/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.mapper;

import com.xddcodec.fs.Log.domain.SysLoginLog;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 登录日志表 Mapper
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 14:39
 */
public interface SysLoginLogMapper {
    int insert(SysLoginLog row);


    List<SysLoginLog> selectPage(@Param("keyword") String keyword, @Param("status") Integer status);
}
