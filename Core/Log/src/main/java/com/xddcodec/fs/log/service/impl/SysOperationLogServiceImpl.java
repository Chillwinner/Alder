/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.log.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.util.StrUtil;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.common.utils.IpUtils;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.Log.domain.SysOperationLog;
import com.xddcodec.fs.Log.domain.dto.OperationLogPageQry;
import com.xddcodec.fs.Log.domain.vo.SysOperationLogVO;
import com.xddcodec.fs.log.mapper.SysOperationLogMapper;
import com.xddcodec.fs.log.service.SysOperationLogService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 操作日志服务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SysOperationLogServiceImpl implements SysOperationLogService {

    private static final int STATUS_SUCCESS = 0;
    private static final int STATUS_FAILURE = 1;

    private final SysOperationLogMapper operationLogMapper;
    private final Converter converter;

    @Override
    public PageResult<SysOperationLogVO> getPages(OperationLogPageQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String keyword = StrUtil.isBlank(qry.getKeyword()) ? null : qry.getKeyword().trim();
        String operationType = StrUtil.isBlank(qry.getOperationType()) ? null : qry.getOperationType().trim();
        Pages.start(qry);
        List<SysOperationLog> records = operationLogMapper.selectPage(workspaceId, keyword, operationType, qry.getStatus());
        List<SysOperationLogVO> vos = converter.convert(records, SysOperationLogVO.class);
        return PageResult.success(vos, new PageInfo<>(records).getTotal());
    }

    @Override
    public void recordSuccess(String operationType,
                              String operationName,
                              String targetType,
                              String targetId,
                              String targetName,
                              String detail) {
        record(WorkspaceContext.getWorkspaceId(), operationType, operationName,
                targetType, targetId, targetName, detail, STATUS_SUCCESS, null, null, null);
    }

    @Override
    public void recordSuccess(String workspaceId,
                              String operationType,
                              String operationName,
                              String targetType,
                              String targetId,
                              String targetName,
                              String detail) {
        record(workspaceId, operationType, operationName,
                targetType, targetId, targetName, detail, STATUS_SUCCESS, null, null, null);
    }

    @Override
    public void recordSuccessAs(String workspaceId,
                                String operatorId,
                                String operatorName,
                                String operationType,
                                String operationName,
                                String targetType,
                                String targetId,
                                String targetName,
                                String detail) {
        record(workspaceId, operationType, operationName,
                targetType, targetId, targetName, detail, STATUS_SUCCESS, null,
                operatorId, operatorName);
    }

    @Override
    public void recordFailure(String operationType,
                              String operationName,
                              String targetType,
                              String targetId,
                              String targetName,
                              String detail,
                              String errorMessage) {
        record(WorkspaceContext.getWorkspaceId(), operationType, operationName,
                targetType, targetId, targetName, detail, STATUS_FAILURE, errorMessage, null, null);
    }

    private void record(String workspaceId,
                        String operationType,
                        String operationName,
                        String targetType,
                        String targetId,
                        String targetName,
                        String detail,
                        int status,
                        String errorMessage,
                        String explicitOperatorId,
                        String explicitOperatorName) {
        try {
            SysOperationLog operationLog = new SysOperationLog();
            if (StrUtil.isNotBlank(explicitOperatorId)) {
                operationLog.setOperatorId(explicitOperatorId);
                operationLog.setOperatorName(StrUtil.blankToDefault(explicitOperatorName, explicitOperatorId));
            } else if (StpUtil.isLogin()) {
                String operatorId = UserContext.getUserId();
                operationLog.setOperatorId(operatorId);
                Object username = StpUtil.getSession().get("username");
                operationLog.setOperatorName(username == null ? operatorId : String.valueOf(username));
            }
            operationLog.setWorkspaceId(workspaceId);
            operationLog.setOperationType(trim(operationType, 64));
            operationLog.setOperationName(trim(operationName, 128));
            operationLog.setTargetType(trim(targetType, 32));
            operationLog.setTargetId(trim(targetId, 128));
            operationLog.setTargetName(trim(targetName, 255));
            operationLog.setDetail(trim(detail, 4000));
            operationLog.setOperationIp(trim(IpUtils.getIpAddr(), 50));
            operationLog.setUserAgent(trim(IpUtils.getUserAgent(), 512));
            operationLog.setStatus(status);
            operationLog.setErrorMessage(trim(errorMessage, 512));
            operationLog.setOperationTime(LocalDateTime.now());
            operationLogMapper.insert(operationLog);
        } catch (Exception e) {
            // 日志记录失败不能影响正常业务操作。
            log.error("记录操作日志失败: type={}, targetId={}", operationType, targetId, e);
        }
    }

    private String trim(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
