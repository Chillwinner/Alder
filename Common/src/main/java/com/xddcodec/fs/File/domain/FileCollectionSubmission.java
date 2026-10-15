/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import com.xddcodec.fs.File.enums.FileCollectionSubmissionStatus;
import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class FileCollectionSubmission extends BaseEntity {

    private String id;

    private String collectionId;

    private String submitterName;

    private String submitterUserId;

    private String submitterIp;

    private String userAgent;

    private String folderId;

    private String uploadTokenHash;

    private Integer fileCount;

    private Long totalSize;

    private FileCollectionSubmissionStatus status;

    private LocalDateTime completedAt;
}
