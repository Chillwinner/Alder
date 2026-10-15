/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Select;
import java.util.List;
import com.xddcodec.fs.System.domain.SysPermission;

/**
 * 权限表 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
public interface SysPermissionMapper {
    @Select("SELECT * FROM sys_permission")
    List<SysPermission> selectAll();

}
