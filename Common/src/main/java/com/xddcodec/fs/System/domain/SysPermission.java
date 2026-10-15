/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain;

import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 权限实体类
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class SysPermission extends BaseEntity {

    /**
     * 自增id
     */
    private Long id;

    /**
     * 权限编码
     */
    private String permissionCode;

    /**
     * 权限名称
     */
    private String permissionName;

    /**
     * 模块
     */
    private String module;

    /**
     * 权限描述
     */
    private String description;

    /**
     * 排序
     */
    private Integer sort;
}
