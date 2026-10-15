/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import com.xddcodec.fs.System.domain.SysUserTransferSetting;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 用户传输设置 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2025/11/11 14:35
 */
public interface SysUserTransferSettingMapper {
    int insert(SysUserTransferSetting row);

    int updateById(SysUserTransferSetting row);


    @Select("SELECT * FROM sys_user_transfer_setting WHERE user_id = #{userId}")
    SysUserTransferSetting selectByUserId(@Param("userId") String userId);

    @Delete("DELETE FROM sys_user_transfer_setting WHERE user_id = #{userId}")
    int deleteByUserId(@Param("userId") String userId);
}
