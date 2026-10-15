/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import com.xddcodec.fs.File.enums.TransferTaskType;
import com.xddcodec.fs.File.enums.TransferTaskStatus;
import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 上传任务表实体类
 *
 * @Author: xddcode
 * @Date: 2025/11/06 15:22
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class FileTransferTask extends BaseEntity {

    /**
     * 主键ID
     */
    private Long id;
    /**
     * 任务ID
     */
    private String taskId;
    /**
     * 唯一上传ID
     */
    private String uploadId;
    /**
     * 用户ID
     */
    private String userId;
    /**
     * 所属工作空间ID
     */
    private String workspaceId;
    /**
     * 文件收集ID（普通上传为空）
     */
    private String collectionId;
    /**
     * 文件收集提交记录ID（普通上传为空）
     */
    private String collectionSubmissionId;
    /**
     * 父目录ID
     */
    private String parentId;
    /**
     * 对象key
     */
    private String objectKey;
    /**
     * 下载时关联的文件ID
     */
    private String fileId;
    /**
     * 文件名
     */
    private String fileName;
    /**
     * 文件大小(字节)
     */
    private Long fileSize;
    /**
     * 文件MD5值
     */
    private String fileMd5;
    /**
     * 文件类型(扩展名)
     */
    private String suffix;
    /**
     * 存储标准MIME类型
     */
    private String mimeType;
    /**
     * 总分片数
     */
    private Integer totalChunks;
    /**
     * 任务类型
     */
    private TransferTaskType taskType;
    /**
     * 已上传分片数
     */
    private Integer uploadedChunks;
    /**
     * 分片大小(默认5MB)
     */
    private Long chunkSize;
    /**
     * 存储平台配置ID
     */
    private String storagePlatformSettingId;
    /**
     * 状态
     */
    private TransferTaskStatus status;
    /**
     * 错误信息
     */
    private String errorMsg;
    /**
     * 开始时间
     */
    private LocalDateTime startTime;
    /**
     * 完成时间
     */
    private LocalDateTime completeTime;
}
