/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.System.domain.SysUserTransferSetting;
import com.xddcodec.fs.System.domain.dto.UserTransferSettingEditCmd;
import com.xddcodec.fs.system.mapper.SysUserTransferSettingMapper;
import com.xddcodec.fs.system.service.SysUserTransferSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * 用户传输设置业务接口实现
 *
 * @Author: xddcode
 * @Date: 2025/11/11 14:35
 */
@Service
@RequiredArgsConstructor
public class SysUserTransferSettingServiceImpl implements SysUserTransferSettingService {

    private final SysUserTransferSettingMapper transferSettingMapper;

    @Override
    public void initUserTransferSetting(String userId) {
        transferSettingMapper.insert(SysUserTransferSetting.init(userId));
    }

    @Override
    @Cacheable(value = "userTransferSetting", keyGenerator = "userKeyGenerator", unless = "#result == null")
    public SysUserTransferSetting getByUser() {
        String userId = UserContext.getUserId();
        SysUserTransferSetting transferSetting = transferSettingMapper.selectByUserId(userId);
        if (transferSetting == null) {
            transferSetting = SysUserTransferSetting.init(userId);
            transferSettingMapper.insert(transferSetting);
        }
        return transferSetting;
    }

    @Override
    @CacheEvict(value = "userTransferSetting", keyGenerator = "userKeyGenerator")
    public void updateUserTransferSetting(UserTransferSettingEditCmd cmd) {
        String userId = UserContext.getUserId();

        SysUserTransferSetting transferSetting = transferSettingMapper.selectByUserId(userId);
        if (transferSetting == null) {
            transferSettingMapper.insert(SysUserTransferSetting.init(userId));
        } else {
            transferSetting.setUserId(userId);
            transferSetting.setDownloadLocation(cmd.getDownloadLocation());
            transferSetting.setIsDefaultDownloadLocation(cmd.getIsDefaultDownloadLocation());
            transferSetting.setConcurrentDownloadQuantity(cmd.getConcurrentDownloadQuantity());
            transferSetting.setConcurrentUploadQuantity(cmd.getConcurrentUploadQuantity());
            transferSetting.setDownloadSpeedLimit(cmd.getDownloadSpeedLimit());
            transferSetting.setChunkSize(cmd.getChunkSize());
            transferSettingMapper.updateById(transferSetting);
        }
    }

    @Override
    @CacheEvict(value = "userTransferSetting", key = "#userId")
    public void deleteUserTransferSetting(String userId) {
        transferSettingMapper.deleteByUserId(userId);
    }

    @Override
    public Long getChunkSize(String userId) {
        SysUserTransferSetting setting = transferSettingMapper.selectByUserId(userId);
        if (setting != null && setting.getChunkSize() != null && setting.getChunkSize() > 0) {
            return setting.getChunkSize();
        }
        // 默认分片大小：5MB
        return 5L * 1024 * 1024;
    }
}
