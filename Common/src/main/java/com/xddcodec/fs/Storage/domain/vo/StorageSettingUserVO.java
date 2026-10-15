/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Storage.domain.vo;

import com.xddcodec.fs.Storage.domain.StorageSetting;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
@AutoMapper(target = StorageSetting.class)
public class StorageSettingUserVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 配置id
     */
    private String id;

    /**
     * 存储平台
     */
    private StoragePlatformVO storagePlatform;

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
}
