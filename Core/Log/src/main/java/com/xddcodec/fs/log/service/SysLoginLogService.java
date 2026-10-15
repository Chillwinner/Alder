/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.service;

import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.Log.domain.SysLoginLog;
import com.xddcodec.fs.Log.domain.dto.LoginLogPageQry;
import com.xddcodec.fs.Log.domain.vo.SysLoginLogVO;

/**
 * 登录日志表 Service
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 14:39
 */
public interface SysLoginLogService {

    /**
     * 分页查询登录日志
     *
     * @param qry
     * @return
     */
    PageResult<SysLoginLogVO> getPages(LoginLogPageQry qry);

    void save(SysLoginLog loginLog);
}
