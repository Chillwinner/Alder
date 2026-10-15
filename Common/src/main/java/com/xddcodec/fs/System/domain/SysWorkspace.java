/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain;

import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 工作空间实体类
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class SysWorkspace extends BaseEntity {

    /**
     * 自增id
     */
    private String id;

    /**
     * 工作空间名称
     */
    private String name;

    /**
     * URL友好的唯一标识
     */
    private String slug;

    /**
     * 描述
     */
    private String description;

    /**
     * 所有者id
     */
    private String ownerId;

    /**
     * 成员数量
     */
    private Integer memberCount;

    /**
     * 协作页 fileshare 根目录（file_info.id）
     */
    private String fileshareFolderId;

    /**
     * 知识入库暂存根目录（file_info.id），与 fileshare 同级
     */
    private String ragFolderId;

    /**
     * 本地目录配额（字节），默认 5GiB
     */
    private Long localQuotaBytes;
}
