/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import com.xddcodec.fs.File.enums.FileCollectionStatus;
import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class FileCollection extends BaseEntity {

    private String id;

    private String userId;

    private String workspaceId;

    private String targetFolderId;

    private String storagePlatformSettingId;

    private String collectionName;

    private String description;

    private String accessCodeHash;

    private LocalDateTime expireTime;

    private Long maxFileSize;

    private String allowedExtensions;

    /** 逗号分隔的空间成员 userId */
    private String assigneeUserIds;

    private FileCollectionStatus status;

    private Integer submissionCount;

    private Integer fileCount;

    private Long totalSize;
}
