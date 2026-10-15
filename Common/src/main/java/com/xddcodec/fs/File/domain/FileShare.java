/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 文件分享实体类
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class FileShare extends BaseEntity {

    private String id;

    /**
     * 分享人ID
     */
    private String userId;

    /**
     * 所属工作空间ID
     */
    private String workspaceId;

    /**
     * 分享名称（默认取第一个文件名）
     */
    private String shareName;

    /**
     * 提取码（可选）
     */
    private String shareCode;

    /**
     * 过期时间
     */
    private LocalDateTime expireTime;

    /**
     * 权限范围: preview,download  (逗号分隔)
     */
    private String scope;

    /**
     * 查看次数
     */
    private Integer viewCount;

    /**
     * 下载次数
     */
    private Integer downloadCount;

    /**
     * 最大查看次数（NULL表示无限制）
     */
    private Integer maxViewCount;

    /**
     * 最大下载次数（NULL表示无限制）
     */
    private Integer maxDownloadCount;
}
