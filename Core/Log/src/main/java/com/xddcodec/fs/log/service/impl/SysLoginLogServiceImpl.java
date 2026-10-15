/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.service.impl;

import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.Log.domain.SysLoginLog;
import com.xddcodec.fs.Log.domain.dto.LoginLogPageQry;
import com.xddcodec.fs.Log.domain.vo.SysLoginLogVO;
import com.xddcodec.fs.log.mapper.SysLoginLogMapper;
import com.xddcodec.fs.log.service.SysLoginLogService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 登录日志表 Service Impl
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 14:40
 */
@Service
@RequiredArgsConstructor
public class SysLoginLogServiceImpl implements SysLoginLogService {

    private final SysLoginLogMapper loginLogMapper;
    private final Converter converter;

    @Override
    public PageResult<SysLoginLogVO> getPages(LoginLogPageQry qry) {
        Pages.start(qry);
        List<SysLoginLog> records = loginLogMapper.selectPage(qry.getKeyword(), qry.getStatus());
        List<SysLoginLogVO> vos = converter.convert(records, SysLoginLogVO.class);
        return PageResult.success(vos, new PageInfo<>(records).getTotal());
    }

    @Override
    public void save(SysLoginLog loginLog) {
        loginLogMapper.insert(loginLog);
    }
}
