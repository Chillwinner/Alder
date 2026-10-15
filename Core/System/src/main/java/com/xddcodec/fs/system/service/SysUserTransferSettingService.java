/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.SysUserTransferSetting;
import com.xddcodec.fs.System.domain.dto.UserTransferSettingEditCmd;

/**
 * 用户传输设置业务接口
 *
 * @Author: xddcode
 * @Date: 2025/11/11 14:35
 */
public interface SysUserTransferSettingService {

    /**
     * 初始化用户配置
     *
     * @param userId 用户id
     */
    void initUserTransferSetting(String userId);

    /**
     * 获取用户传输设置
     *
     * @return
     */
    SysUserTransferSetting getByUser();

    /**
     * 更新用户传输配置
     *
     * @param cmd 传输配置信息
     */
    void updateUserTransferSetting(UserTransferSettingEditCmd cmd);

    /**
     * 删除用户传输配置
     *
     * @param userId 用户id
     */
    void deleteUserTransferSetting(String userId);

    /**
     * 获取用户的分片大小配置
     *
     * @param userId 用户id
     * @return 分片大小（字节），默认 5MB
     */
    Long getChunkSize(String userId);
}
