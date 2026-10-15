/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 角色权限关联实体类
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
@Data
public class SysRolePermission implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private Long roleId;

    private String roleCode;

    private String permissionCode;
}
