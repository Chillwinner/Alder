/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.System.domain.SysUser;
import org.apache.ibatis.annotations.Param;

/**
 * 用户表 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2024/6/7 10:57
 */
public interface SysUserMapper {
    @Select("SELECT * FROM sys_user WHERE id = #{id}")
    SysUser selectById(@Param("id") String id);

    int insert(SysUser row);

    int updateById(SysUser row);


    @Select("SELECT * FROM sys_user WHERE username = #{username}")
    SysUser selectByUsername(@Param("username") String username);

    @Select("SELECT * FROM sys_user WHERE email = #{email}")
    SysUser selectByEmail(@Param("email") String email);

    @Select("SELECT * FROM sys_user WHERE username = #{account} OR email = #{account}")
    SysUser selectByUsernameOrEmail(@Param("account") String account);
}
