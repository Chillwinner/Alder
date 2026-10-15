/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Storage.domain;

import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 存储平台配置表
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:30
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class StorageSetting extends BaseEntity {

    /**
     * 自增id
     */
    private String id;

    /**
     * 存储平台标识符
     */
    private String platformIdentifier;

    /**
     * 配置数据
     */
    private String configData;

    /**
     * 是否启用 0-否 1-是
     */
    private Integer enabled;

    /**
     * 所属工作空间ID
     */
    private String workspaceId;

    /**
     * 备注
     */
    private String remark;

    /**
     * 是否逻辑删除 0-否 1-是
     */
    private Integer deleted;
}
