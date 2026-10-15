/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.file.cache.TransferTaskCacheManager;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileTransferTask;
import com.xddcodec.fs.File.domain.dto.CheckUploadCmd;
import com.xddcodec.fs.File.domain.dto.InitUploadCmd;
import com.xddcodec.fs.File.domain.dto.UploadChunkCmd;
import com.xddcodec.fs.File.domain.qry.TransferFilesQry;
import com.xddcodec.fs.File.domain.vo.CheckUploadResultVO;
import com.xddcodec.fs.File.domain.vo.FileDownloadVO;
import com.xddcodec.fs.File.domain.vo.FileTransferTaskVO;
import com.xddcodec.fs.File.domain.vo.FolderDownloadTaskVO;
import com.xddcodec.fs.File.enums.TransferTaskType;
import com.xddcodec.fs.file.handler.UploadTaskExceptionHandler;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.mapper.FileTransferTaskMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.LocalQuotaService;
import com.xddcodec.fs.file.service.FileObjectReferenceService;
import com.xddcodec.fs.file.service.StorageMountService;
import com.xddcodec.fs.file.service.FileTransferTaskService;
import com.xddcodec.fs.file.service.WorkspaceRagAccess;
import com.xddcodec.fs.File.enums.TransferTaskStatus;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.StorageOperationException;
import com.xddcodec.fs.common.utils.ErrorMessageUtils;
import org.apache.commons.lang3.StringUtils;
import com.xddcodec.fs.file.service.TransferSseService;
import com.xddcodec.fs.log.constant.OperationType;
import com.xddcodec.fs.log.service.SysOperationLogService;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import com.xddcodec.fs.storage.plugin.s3.S3StorageService;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.SysUserTransferSetting;
import com.xddcodec.fs.system.service.SysUserService;
import com.xddcodec.fs.system.service.SysUserTransferSettingService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 文件传输任务服务实现
 *
 * @author xddcode
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileTransferTaskServiceImpl implements FileTransferTaskService {

    private final FileTransferTaskMapper fileTransferTaskMapper;
    private final FileInfoMapper fileInfoMapper;
    private final Converter converter;
    private final FileInfoService fileInfoService;
    private final StorageMountService storageMountService;
    private final WorkspaceRagAccess workspaceRagAccess;
    private final FileObjectReferenceService objectReferenceService;
    private final TransferSseService transferSseService;
    private final TransferTaskCacheManager cacheManager;
    private final UploadTaskExceptionHandler exceptionHandler;
    private final TaskExecutor chunkUploadExecutor;
    private final TaskExecutor fileMergeExecutor;
    private final StorageServiceFacade storageServiceFacade;
    private final SysUserService sysUserService;
    private final SysUserTransferSettingService userTransferSettingService;
    private final SysOperationLogService operationLogService;
    private final LocalQuotaService localQuotaService;
    @Value("${spring.application.name:free-fs}")
    private String applicationName;
    private final com.xddcodec.fs.file.transfer.FolderDownloadService folderDownloadService;

    @Override
    public List<FileTransferTaskVO> getTransferFiles(TransferFilesQry qry) {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();
        List<FileTransferTask> tasks = fileTransferTaskMapper.selectTransferList(
                userId, workspaceId, storagePlatformSettingId, qry == null ? null : qry.getStatusType());
        List<FileTransferTaskVO> voList = converter.convert(tasks, FileTransferTaskVO.class);

        // 计算并填充进度相关字段
        for (FileTransferTaskVO vo : voList) {
            calculateProgressFields(vo);

            // 检查是否有缓存的完成事件（SSE 推送失败的情况）
            if (vo.getStatus() == TransferTaskStatus.completed) {
                Object completeEvent = cacheManager.getAndRemoveCompleteEvent(vo.getTaskId());
                if (completeEvent != null) {
                    log.info("检测到未推送的完成事件，通过轮询返回: taskId={}", vo.getTaskId());
                    vo.setCompleteEventData(completeEvent);
                }
            }
        }

        return voList;
    }

    /**
     * 计算并填充进度相关字段
     */
    private void calculateProgressFields(FileTransferTaskVO vo) {
        String taskId = vo.getTaskId();

        // 获取已传输字节数（上传和下载都使用相同的缓存键）
        long transferredBytes = cacheManager.getTransferredBytes(taskId);
        vo.setUploadedSize(transferredBytes); // 字段名为 uploadedSize，但对下载任务也表示已下载字节数

        // 计算进度百分比（整数，0-100）
        if (vo.getFileSize() != null && vo.getFileSize() > 0) {
            double progressPercent = (transferredBytes * 100.0) / vo.getFileSize();
            // 四舍五入取整
            int progressInt = (int) Math.round(Math.min(progressPercent, 100.0));
            vo.setProgress(progressInt);
        } else {
            vo.setProgress(0);
        }

        // 计算速度和剩余时间（仅对进行中的任务）
        if (vo.getStatus() != null &&
                (vo.getStatus().name().equals("uploading") || vo.getStatus().name().equals("downloading"))) {

            Long startTime = cacheManager.getStartTime(taskId);
            if (startTime != null && transferredBytes > 0) {
                long elapsedSeconds = (System.currentTimeMillis() - startTime) / 1000;

                if (elapsedSeconds > 0) {
                    // 计算平均速度 (bytes/s)
                    long speed = transferredBytes / elapsedSeconds;
                    vo.setSpeed(speed);

                    // 计算剩余时间（秒）
                    if (speed > 0 && vo.getFileSize() != null) {
                        long remainingBytes = vo.getFileSize() - transferredBytes;
                        int remainTime = (int) (remainingBytes / speed);
                        vo.setRemainTime(remainTime);
                    } else {
                        vo.setRemainTime(null);
                    }
                } else {
                    vo.setSpeed(0L);
                    vo.setRemainTime(null);
                }
            } else {
                vo.setSpeed(0L);
                vo.setRemainTime(null);
            }
        } else {
            // 非进行中的任务不显示速度和剩余时间
            vo.setSpeed(null);
            vo.setRemainTime(null);
        }
    }

    /**
     * 初始化上传
     *
     * @param cmd 初始化上传命令
     * @return 任务ID
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public String initUpload(InitUploadCmd cmd) {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        StorageMountService.LiveUpload live = storageMountService.resolveLiveUpload(cmd.getParentId(), cmd.getFileName());
        String parentId = live != null
                ? live.parentId()
                : storageMountService.catalogParent(cmd.getParentId());
        String storagePlatformSettingId = live == null ? null : live.storageSettingId();
        workspaceRagAccess.assertAdminWriteOnParent(parentId);
        if (live == null && parentId != null) {
            FileInfo parent = fileInfoService.getAuthorizedFile(parentId);
            storagePlatformSettingId = parent.getStoragePlatformSettingId();
        }
        try {
            String taskId = IdUtil.fastSimpleUUID();
            String suffix = FileUtil.extName(cmd.getFileName());
            String tempFileName = IdUtil.fastSimpleUUID() + "." + suffix;
            String objectKey = live != null
                    ? live.objectKey()
                    : applicationName + "/" + userId + "/"
                    + DateUtil.format(new java.util.Date(), "yyyyMMdd") + "/" + tempFileName;
            boolean nameExists = live == null && fileInfoService.existsSameNameFile(
                    workspaceId,
                    parentId,
                    cmd.getFileName(),
                    storagePlatformSettingId
            );
            if (nameExists && !Boolean.TRUE.equals(cmd.getAllowRename())) {
                throw new BusinessException(ErrorMessages.FILE_NAME_CONFLICT);
            }
            String displayName = live != null
                    ? live.displayName()
                    : nameExists
                    ? fileInfoService.generateUniqueName(
                    workspaceId,
                    parentId,
                    cmd.getFileName(),
                    false,
                    null,
                    storagePlatformSettingId)
                    : cmd.getFileName();
            FileTransferTask task = new FileTransferTask();
            task.setTaskId(taskId);
            task.setUserId(userId);
            task.setWorkspaceId(workspaceId);
            task.setParentId(parentId);
            task.setFileName(displayName);
            task.setFileSize(cmd.getFileSize());
            task.setSuffix(FileUtil.getSuffix(cmd.getFileName()));
            task.setMimeType(cmd.getMimeType());
            task.setTotalChunks(cmd.getTotalChunks());
            task.setUploadedChunks(0);
            task.setTaskType(TransferTaskType.upload);
            task.setChunkSize(cmd.getChunkSize());
            task.setObjectKey(objectKey);
            task.setStoragePlatformSettingId(storagePlatformSettingId);
            task.setStatus(TransferTaskStatus.initialized); // 初始化状态
            task.setStartTime(LocalDateTime.now());
            localQuotaService.ensureRoom(workspaceId, storagePlatformSettingId, cmd.getFileSize());
            fileTransferTaskMapper.insert(task);
            cacheManager.cacheTask(task);
            cacheManager.recordStartTime(task.getTaskId());

            // 推送初始化成功状态事件
            transferSseService.sendStatusEvent(userId, taskId,
                    TransferTaskStatus.initialized.name(), null);

            log.info("初始化上传成功: fileName={}", cmd.getFileName());
            return task.getTaskId();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("初始化上传失败: fileName={}", cmd.getFileName(), e);
            throw new StorageOperationException(ErrorMessages.TASK_INIT_FAILED, e);
        }
    }

    @Override
    public CheckUploadResultVO checkUpload(CheckUploadCmd cmd) {
        String userId = UserContext.getUserId();
        String taskId = cmd.getTaskId();
        // 获取任务
        FileTransferTask task = null;
        try {
            task = getAuthorizedTask(taskId);
            String storagePlatformSettingId = task.getStoragePlatformSettingId();
            if (!TransferTaskStatus.initialized.equals(task.getStatus())) {
                throw new BusinessException(ErrorMessages.TASK_STATUS_INCORRECT);
            }
            updateTaskStatus(task, TransferTaskStatus.checking);

            transferSseService.sendStatusEvent(userId, taskId,
                    TransferTaskStatus.checking.name(), null);
            // 相同存储配置中的相同内容全局复用；回收站记录也属于有效引用。
            try (FileObjectReferenceService.ReferenceLock ignored =
                         objectReferenceService.acquireContentLock(
                                 storagePlatformSettingId,
                                 cmd.getFileMd5(),
                                 task.getFileSize())) {
                FileInfo existFile = objectReferenceService.findReusableFile(
                        cmd.getFileMd5(), task.getFileSize(), storagePlatformSettingId);
                if (existFile != null) {
                    try (FileObjectReferenceService.ReferenceLock objectLock =
                                 objectReferenceService.acquireObjectLock(
                                         existFile.getStoragePlatformSettingId(), existFile.getObjectKey())) {
                        return handleQuickUpload(task, existFile, cmd.getFileMd5(), storagePlatformSettingId);
                    }
                }

                // 0 字节文件不需要分片上传，但仍在内容锁内创建，避免并发产生重复对象。
                if (task.getFileSize() == null || task.getFileSize() == 0) {
                    log.info("检测到空文件上传，直接执行快速完成逻辑: taskId={}", taskId);
                    return handleEmptyFileUpload(task, cmd.getFileMd5(), storagePlatformSettingId);
                }
            }
            task.setFileMd5(cmd.getFileMd5());
            String uploadId;
            String protocol;
            if (storageServiceFacade.isLocal(storagePlatformSettingId)) {
                uploadId = taskId;
                protocol = "tus";
            } else {
                S3StorageService s3 = storageServiceFacade.getS3(storagePlatformSettingId);
                uploadId = s3.initiateMultipartUpload(task.getObjectKey(), task.getMimeType());
                protocol = "s3";
            }
            task.setUploadId(uploadId);

            updateTaskStatus(task, TransferTaskStatus.uploading);

            transferSseService.sendStatusEvent(userId, taskId,
                    TransferTaskStatus.uploading.name(), null);

            return CheckUploadResultVO.builder()
                    .isQuickUpload(false)
                    .taskId(taskId)
                    .uploadId(uploadId)
                    .protocol(protocol)
                    .message(null)
                    .build();
        } catch (Exception e) {
            log.error("文件校验失败: taskId={}", taskId, e);
            exceptionHandler.handleTaskFailed(taskId, "task.check.failed", e);
            throw new StorageOperationException(ErrorMessages.TASK_CHECK_FAILED, e);
        }
    }

    /**
     * 处理 0 字节文件的特殊逻辑
     */
    private CheckUploadResultVO handleEmptyFileUpload(FileTransferTask task, String fileMd5, String storagePlatformSettingId) {
        String taskId = task.getTaskId();
        IStorageOperationService storageService = storageServiceFacade.getStorageService(storagePlatformSettingId);
        try {
            // 既然是空文件，直接通过简单上传接口上传一个空的 InputStream
            storageService.uploadFile(new ByteArrayInputStream(new byte[0]), task.getObjectKey());

            // 复用秒传的后续逻辑：创建 FileInfo 并更新任务状态
            // 构造一个临时的 FileInfo 对象用于 handleQuickUpload
            FileInfo emptyFileInfo = new FileInfo();
            emptyFileInfo.setObjectKey(task.getObjectKey());

            return handleQuickUpload(task, emptyFileInfo, fileMd5, storagePlatformSettingId);
        } catch (Exception e) {
            log.error("空文件处理失败: taskId={}", taskId, e);
            throw new StorageOperationException(ErrorMessages.TASK_EMPTY_FILE_FAILED, e);
        }
    }

    /**
     * 处理秒传
     */
    protected CheckUploadResultVO handleQuickUpload(FileTransferTask task,
                                                    FileInfo existFile,
                                                    String fileMd5, String storagePlatformSettingId) {
        String taskId = task.getTaskId();

        try {
            // 创建新的文件记录（引用相同的 objectKey）
            String fileId = IdUtil.fastSimpleUUID();
            LocalDateTime now = LocalDateTime.now();
            String displayName = fileInfoService.generateUniqueName(
                    task.getWorkspaceId(),
                    task.getParentId(),
                    task.getFileName(),
                    false,
                    null,
                    storagePlatformSettingId
            );
            FileInfo newFileInfo = new FileInfo();
            newFileInfo.setId(fileId);
            newFileInfo.setObjectKey(existFile.getObjectKey());
            newFileInfo.setOriginalName(task.getFileName());
            newFileInfo.setDisplayName(displayName);
            newFileInfo.setSuffix(task.getSuffix());
            newFileInfo.setSize(task.getFileSize());
            newFileInfo.setMimeType(task.getMimeType());
            newFileInfo.setIsDir(false);
            newFileInfo.setParentId(task.getParentId());
            newFileInfo.setWorkspaceId(task.getWorkspaceId());
            newFileInfo.setUserId(task.getUserId());
            newFileInfo.setContentMd5(fileMd5);
            newFileInfo.setStoragePlatformSettingId(task.getStoragePlatformSettingId());
            newFileInfo.setUploadTime(now);
            newFileInfo.setUpdateTime(now);
            newFileInfo.setIsDeleted(false);

            persistUploaded(task, newFileInfo);

            operationLogService.recordSuccessAs(
                    task.getWorkspaceId(),
                    task.getUserId(),
                    resolveOperatorName(task.getUserId()),
                    OperationType.UPLOAD,
                    "上传文件（秒传）",
                    "FILE",
                    newFileInfo.getId(),
                    newFileInfo.getDisplayName(),
                    "文件大小: " + FileUtil.readableFileSize(newFileInfo.getSize())
            );

            // 更新任务状态为已完成
            task.setFileMd5(fileMd5);
            task.setUploadedChunks(task.getTotalChunks()); // 标记为全部完成
            task.setStatus(TransferTaskStatus.completed);
            task.setCompleteTime(now);
            fileTransferTaskMapper.updateById(task);

            // 清理缓存
            cacheManager.cleanTask(taskId);

            // 推送完成事件
            transferSseService.sendCompleteEvent(task.getUserId(), taskId, fileId,
                    displayName, task.getFileSize());

            log.info("秒传成功: taskId={}, newFileId={}, refObjectKey={}",
                    taskId, fileId, existFile.getObjectKey());

            return CheckUploadResultVO.builder()
                    .isQuickUpload(true)
                    .taskId(taskId)
                    .fileId(fileId)
                    .message(null)
                    .build();
        } catch (Exception e) {
            log.error("秒传处理失败: taskId={}", taskId, e);
            throw new StorageOperationException(ErrorMessages.TASK_QUICK_UPLOAD_FAILED, e);
        }
    }

    /**
     * 上传分片
     *
     * @param fileBytes 分片文件字节数组
     * @param cmd       上传分片命令
     */
    @Override
    public void uploadChunk(byte[] fileBytes, UploadChunkCmd cmd) {
        String taskId = cmd.getTaskId();
        Integer chunkIndex = cmd.getChunkIndex();
        getAuthorizedTask(taskId);
        // 异步上传分片
        CompletableFuture.runAsync(() -> {
            try {
                doUploadChunk(fileBytes, cmd);

                // 检查是否所有分片都已上传完成
                checkAndAutoMerge(taskId);
            } catch (Exception e) {
                log.error("分片上传失败: taskId={}, chunkIndex={}", taskId, cmd.getChunkIndex(), e);
                exceptionHandler.handleChunkUploadFailed(taskId, chunkIndex, e.getMessage(), e);
            }
        }, chunkUploadExecutor);
    }

    /**
     * 检查并自动触发合并（当所有分片上传完成时）
     */
    private void checkAndAutoMerge(String taskId) {
        try {
            FileTransferTask task = getTaskFromCacheOrDB(taskId);

            // 只有 uploading 状态才检查
            if (!TransferTaskStatus.uploading.equals(task.getStatus())) {
                return;
            }

            Integer uploadedCount = cacheManager.getTransferredChunks(taskId);

            // 所有分片都上传完成
            if (uploadedCount.equals(task.getTotalChunks())) {
                // 使用分布式锁防止并发检查导致重复触发合并
                String lockKey = "merge:lock:" + taskId;
                boolean locked = cacheManager.tryLock(lockKey, 300); // 5分钟锁

                if (!locked) {
                    log.debug("合并任务已被其他线程触发，跳过: taskId={}", taskId);
                    return;
                }

                try {
                    // 再次检查状态（双重检查，防止状态已变更）
                    task = getTaskFromCacheOrDB(taskId);
                    if (!TransferTaskStatus.uploading.equals(task.getStatus())) {
                        log.debug("任务状态已变更，跳过合并: taskId={}, status={}", taskId, task.getStatus());
                        return;
                    }

                    log.info("所有分片上传完成，触发自动合并: taskId={}", taskId);

                    // 异步执行合并，避免阻塞上传线程
                    // 注意：锁会在合并完成后由合并任务自己释放
                    CompletableFuture.runAsync(() -> {
                        try {
                            doMergeChunks(taskId);
                        } catch (Exception e) {
                            log.error("自动合并失败: taskId={}", taskId, e);
                            exceptionHandler.handleTaskFailed(taskId, "文件合并失败: " + e.getMessage(), e);
                        } finally {
                            // 合并完成后释放锁
                            cacheManager.releaseLock(lockKey);
                        }
                    }, fileMergeExecutor);
                } catch (Exception e) {
                    // 如果提交异步任务失败，需要释放锁
                    cacheManager.releaseLock(lockKey);
                    throw e;
                }
            }
        } catch (Exception e) {
            log.error("检查自动合并失败: taskId={}", taskId, e);
            // 不抛出异常，避免影响分片上传
        }
    }

    /**
     * 上传分片
     */
    private void doUploadChunk(byte[] fileBytes, UploadChunkCmd cmd) throws IOException {
        String taskId = cmd.getTaskId();
        Integer chunkIndex = cmd.getChunkIndex();
        FileTransferTask task = getTaskFromCacheOrDB(taskId);
        if (task.getStatus() == TransferTaskStatus.canceled) {
            log.info("任务已取消，停止上传: taskId={}, chunkIndex={}", taskId, chunkIndex);
            return;
        }
        if (task.getStatus() == TransferTaskStatus.paused) {
            log.info("任务已暂停，停止上传: taskId={}, chunkIndex={}", taskId, chunkIndex);
            return;
        }
        if (!TransferTaskStatus.uploading.equals(task.getStatus())) {
            throw new BusinessException(ErrorMessages.TASK_STATUS_INCORRECT_EXPECTED);
        }
        // 检查分片是否已存在（避免重复上传）
        if (cacheManager.isChunkTransferred(taskId, chunkIndex)) {
            log.info("分片已存在，跳过上传: taskId={}, chunkIndex={}", taskId, chunkIndex);
            return;
        }

        String eTag;
        try (ByteArrayInputStream bis = new ByteArrayInputStream(fileBytes)) {
            if (storageServiceFacade.isLocal(task.getStoragePlatformSettingId())) {
                long offset = (long) chunkIndex * task.getChunkSize();
                storageServiceFacade.getLocalStore().writeAt(
                        task.getObjectKey(), offset, bis, fileBytes.length);
                eTag = String.valueOf(fileBytes.length);
            } else {
                eTag = storageServiceFacade.getS3(task.getStoragePlatformSettingId()).uploadPart(
                        task.getObjectKey(),
                        task.getUploadId(),
                        chunkIndex,
                        fileBytes.length,
                        bis);
            }
        }
        cacheManager.addTransferredChunk(taskId, chunkIndex, eTag);
        cacheManager.recordTransferredBytes(taskId, fileBytes.length);

        // 推送进度事件
        Integer uploadedChunks = cacheManager.getTransferredChunks(taskId);
        long uploadedBytes = cacheManager.getTransferredBytes(taskId);
        transferSseService.sendProgressEvent(task.getUserId(), taskId,
                uploadedBytes, task.getFileSize(), uploadedChunks, task.getTotalChunks());

        log.info("分片上传成功: taskId={}, chunkIndex={}, progress={}/{}",
                taskId, chunkIndex, uploadedChunks, task.getTotalChunks());
    }

    @Override
    public void pauseTransfer(String taskId) {
        FileTransferTask task = null;
        try {
            task = getAuthorizedTask(taskId);
            TransferTaskStatus currentStatus = task.getStatus();

            // 验证当前状态是否支持暂停（上传或下载中）
            if (!TransferTaskStatus.uploading.equals(currentStatus)
                    && !TransferTaskStatus.downloading.equals(currentStatus)) {
                throw new BusinessException(ErrorMessages.TASK_STATUS_NOT_SUPPORT_PAUSE);
            }

            // 验证状态转换合法性
            validateStateTransition(currentStatus, TransferTaskStatus.paused);

            // 更新数据库状态
            updateTaskStatus(task, TransferTaskStatus.paused);

            // 推送暂停状态事件
            String taskTypeDesc = task.getTaskType() == TransferTaskType.upload ? "上传" : "下载";
            transferSseService.sendStatusEvent(task.getUserId(), taskId,
                    TransferTaskStatus.paused.name(), null);

            log.info("暂停{}任务: taskId={}, taskType={}", taskTypeDesc, taskId, task.getTaskType());
        } catch (Exception e) {
            log.error("暂停失败: taskId={}", taskId, e);
            if (task != null) {
                String userFriendlyMsg = ErrorMessageUtils.extractUserFriendlyMessage(e);
                transferSseService.sendErrorEvent(task.getUserId(), taskId,
                        "PAUSE_FAILED", "transfer.pause.failed");
            }
            throw new StorageOperationException(ErrorMessages.TRANSFER_PAUSE_FAILED, e);
        }
    }

    @Override
    public void resumeTransfer(String taskId) {
        FileTransferTask task = null;
        try {
            task = getAuthorizedTask(taskId);
            TransferTaskStatus currentStatus = task.getStatus();

            // 验证当前状态是否支持恢复
            if (!TransferTaskStatus.paused.equals(currentStatus)) {
                throw new BusinessException(ErrorMessages.TASK_STATUS_NOT_SUPPORT_RESUME);
            }

            // 根据任务类型确定目标状态
            TransferTaskStatus newStatus = task.getTaskType() == TransferTaskType.upload
                    ? TransferTaskStatus.uploading
                    : TransferTaskStatus.downloading;

            // 验证状态转换合法性
            validateStateTransition(currentStatus, newStatus);

            // 更新任务状态
            updateTaskStatus(task, newStatus);

            // 获取已传输的分片信息（上传任务使用 transferredChunkList，下载任务使用 downloadedChunks）
            int transferredCount;
            if (task.getTaskType() == TransferTaskType.upload) {
                Map<Integer, String> transferredChunks = cacheManager.getTransferredChunkList(taskId);
                transferredCount = transferredChunks.size();
            } else {
                Set<Integer> downloadedChunks = getDownloadedChunks(taskId);
                transferredCount = downloadedChunks.size();
            }

            // 推送恢复状态事件
            String taskTypeDesc = task.getTaskType() == TransferTaskType.upload ? "上传" : "下载";
            transferSseService.sendStatusEvent(task.getUserId(), taskId,
                    newStatus.name(), null);

            log.info("继续{}任务成功: taskId={}, taskType={}, transferredChunks={}/{}",
                    taskTypeDesc, taskId, task.getTaskType(), transferredCount, task.getTotalChunks());
        } catch (Exception e) {
            log.error("继续任务失败: taskId={}", taskId, e);
            if (task != null) {
                String userFriendlyMsg = ErrorMessageUtils.extractUserFriendlyMessage(e);
                transferSseService.sendErrorEvent(task.getUserId(), taskId,
                        "RESUME_FAILED", "transfer.resume.failed");
            }
            throw new StorageOperationException(ErrorMessages.TRANSFER_RESUME_FAILED, e);
        }
    }

    @Override
    public Set<Integer> getUploadedChunks(String taskId) {
        getAuthorizedTask(taskId);
        Map<Integer, String> chunks = cacheManager.getTransferredChunkList(taskId);
        return chunks.keySet();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelTransfer(String taskId) {
        FileTransferTask task = null;
        try {
            task = getAuthorizedTask(taskId);
            TransferTaskStatus currentStatus = task.getStatus();

            // 检查任务状态是否可以取消
            if (TransferTaskStatus.completed.equals(currentStatus)) {
                throw new BusinessException(ErrorMessages.TASK_COMPLETED_CANNOT_CANCEL);
            }

            // 验证状态转换合法性
            validateStateTransition(currentStatus, TransferTaskStatus.canceled);

            // 推送取消中状态事件
            String taskTypeDesc = task.getTaskType() == TransferTaskType.upload ? "上传" : "下载";
            transferSseService.sendStatusEvent(task.getUserId(), taskId,
                    "cancelling", null);

            // 修改状态为已取消
            cacheManager.updateTaskStatus(taskId, TransferTaskStatus.canceled);

            // 短暂延迟，确保前端收到消息并停止传输
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            // 如果是上传任务且已经初始化了分片上传，需要中止分片上传
            if (TransferTaskType.upload.equals(task.getTaskType())
                    && task.getUploadId() != null
                    && !task.getUploadId().isEmpty()) {
                try {
                    abortIncompleteUpload(task);
                    log.info("已中止分片上传: taskId={}, uploadId={}", taskId, task.getUploadId());
                } catch (Exception e) {
                    log.error("中止分片上传失败: taskId={}, uploadId={}", taskId, task.getUploadId(), e);
                }
            }

            // 删除任务记录
            fileTransferTaskMapper.deleteById(task.getId());

            // 清理缓存（包括下载任务的进度记录）
            cacheManager.cleanTask(taskId);

            // 推送已取消状态事件
            transferSseService.sendStatusEvent(task.getUserId(), taskId,
                    TransferTaskStatus.canceled.name(), null);

            log.info("取消{}任务成功: taskId={}, taskType={}", taskTypeDesc, taskId, task.getTaskType());
        } catch (Exception e) {
            log.error("取消传输任务异常: taskId={}", taskId, e);
            if (task != null) {
                String userFriendlyMsg = ErrorMessageUtils.extractUserFriendlyMessage(e);
                transferSseService.sendErrorEvent(task.getUserId(), taskId,
                        "CANCEL_FAILED", "transfer.cancel.failed");
            }
            throw new StorageOperationException(ErrorMessages.TRANSFER_CANCEL_FAILED, e);
        }
    }

    @Override
    public long tusOffset(String taskId) {
        FileTransferTask task = getAuthorizedTask(taskId);
        return storageServiceFacade.getLocalStore().fileSize(task.getObjectKey());
    }

    @Override
    public long tusPatch(String taskId, long offset, InputStream inputStream, long length) {
        FileTransferTask task = getAuthorizedTask(taskId);
        if (!TransferTaskStatus.uploading.equals(task.getStatus())) {
            throw new BusinessException(ErrorMessages.TASK_STATUS_INCORRECT_EXPECTED);
        }
        LocalStorageOperationService local = storageServiceFacade.getLocalStore();
        long current = local.fileSize(task.getObjectKey());
        if (offset != current) {
            throw new BusinessException(409, "Upload-Offset 不匹配");
        }
        local.writeAt(task.getObjectKey(), offset, inputStream, length);
        long next = local.fileSize(task.getObjectKey());
        cacheManager.recordTransferredBytes(taskId, length);
        int uploadedChunks = 0;
        if (task.getChunkSize() != null && task.getChunkSize() > 0) {
            uploadedChunks = (int) (next / task.getChunkSize());
        }
        transferSseService.sendProgressEvent(task.getUserId(), taskId,
                next, task.getFileSize(), uploadedChunks, task.getTotalChunks());
        return next;
    }

    private void abortIncompleteUpload(FileTransferTask task) {
        if (storageServiceFacade.isLocal(task.getStoragePlatformSettingId())) {
            storageServiceFacade.getStorageService(task.getStoragePlatformSettingId())
                    .deleteFile(task.getObjectKey());
            return;
        }
        storageServiceFacade.getS3(task.getStoragePlatformSettingId())
                .abortMultipartUpload(task.getObjectKey(), task.getUploadId());
    }

    @Override
    @Transactional
    public FileInfo mergeChunks(String taskId) {
        getAuthorizedTask(taskId);
        return doMergeChunks(taskId);
    }

    public FileInfo doMergeChunks(String taskId) {
        FileTransferTask task = null;
        try {
            log.info("开始合并文件: taskId={}", taskId);
            task = getByTaskId(taskId);
            if (task == null) {
                throw new StorageOperationException(ErrorMessages.TASK_NOT_EXIST);
            }

            // 验证当前状态是否允许合并
            if (!TransferTaskStatus.uploading.equals(task.getStatus())) {
                throw new BusinessException(ErrorMessages.TASK_STATUS_INCORRECT);
            }

            if (!storageServiceFacade.isLocal(task.getStoragePlatformSettingId())) {
                Integer uploadedCount = cacheManager.getTransferredChunks(taskId);
                if (!uploadedCount.equals(task.getTotalChunks())) {
                    throw new StorageOperationException(ErrorMessages.TASK_CHUNKS_INCOMPLETE);
                }
            }

            log.info("所有分片上传完成，开始合并: taskId={}, totalChunks={}", taskId, task.getTotalChunks());

            // 更新状态为 merging
            updateTaskStatus(task, TransferTaskStatus.merging);

            // 推送 merging 状态事件
            transferSseService.sendStatusEvent(task.getUserId(), taskId,
                    TransferTaskStatus.merging.name(), null);

            log.info("状态已更新为 merging: taskId={}", taskId);
            IStorageOperationService storageService = storageServiceFacade.getStorageService(task.getStoragePlatformSettingId());
            if (storageServiceFacade.isLocal(task.getStoragePlatformSettingId())) {
                long size = storageServiceFacade.getLocalStore().fileSize(task.getObjectKey());
                if (task.getFileSize() != null && size != task.getFileSize()) {
                    throw new StorageOperationException(ErrorMessages.TASK_CHUNKS_INCOMPLETE);
                }
            } else {
                Map<Integer, String> chunkETags = cacheManager.getTransferredChunkList(taskId);
                log.info("验证分片ETag完整性: taskId={}, totalChunks={}, cachedChunks={}",
                        taskId, task.getTotalChunks(), chunkETags.size());
                if (chunkETags.size() != task.getTotalChunks()) {
                    throw new StorageOperationException(ErrorMessages.TASK_CHUNKS_MISMATCH);
                }
                List<Map<String, Object>> partETags = new ArrayList<>();
                for (int i = 0; i < task.getTotalChunks(); i++) {
                    String etag = chunkETags.get(i);
                    if (etag == null || etag.isEmpty()) {
                        throw new StorageOperationException(ErrorMessages.TASK_CHUNK_ETAG_MISSING);
                    }
                    Map<String, Object> partInfo = new HashMap<>();
                    partInfo.put("partNumber", i);
                    partInfo.put("eTag", etag);
                    partETags.add(partInfo);
                }
                storageServiceFacade.getS3(task.getStoragePlatformSettingId()).completeMultipartUpload(
                        task.getObjectKey(),
                        task.getUploadId(),
                        partETags
                );
            }

            LocalDateTime completeTime = LocalDateTime.now();
            String uploadedObjectKey = task.getObjectKey();
            FileInfo fileInfo;

            // 合并完成后再次去重，解决多个相同文件并发上传时都未命中秒传的问题。
            try (FileObjectReferenceService.ReferenceLock ignored =
                         objectReferenceService.acquireContentLock(
                                 task.getStoragePlatformSettingId(),
                                 task.getFileMd5(),
                                 task.getFileSize())) {
                FileInfo reusableFile = objectReferenceService.findReusableFile(
                        task.getFileMd5(), task.getFileSize(), task.getStoragePlatformSettingId());
                if (reusableFile != null) {
                    try (FileObjectReferenceService.ReferenceLock objectLock =
                                 objectReferenceService.acquireObjectLock(
                                         reusableFile.getStoragePlatformSettingId(), reusableFile.getObjectKey())) {
                        fileInfo = persistUploaded(task, buildUploadedFileInfo(task, reusableFile.getObjectKey(), completeTime));
                    }
                } else {
                    fileInfo = persistUploaded(task, buildUploadedFileInfo(task, uploadedObjectKey, completeTime));
                }
            }

            if (!Objects.equals(uploadedObjectKey, fileInfo.getObjectKey())) {
                try {
                    storageService.deleteFile(uploadedObjectKey);
                    log.info("并发上传去重成功，删除重复物理对象: taskId={}, objectKey={}",
                            taskId, uploadedObjectKey);
                } catch (Exception deleteError) {
                    // 数据库已经引用已有对象，此处失败只会留下孤立对象，不会造成文件丢失。
                    log.warn("删除并发上传产生的重复对象失败: taskId={}, objectKey={}",
                            taskId, uploadedObjectKey, deleteError);
                }
            }

            task.setStatus(TransferTaskStatus.completed);
            task.setUploadedChunks(task.getTotalChunks());
            task.setCompleteTime(completeTime);
            fileTransferTaskMapper.updateById(task);

            operationLogService.recordSuccessAs(
                    task.getWorkspaceId(),
                    task.getUserId(),
                    resolveOperatorName(task.getUserId()),
                    OperationType.UPLOAD,
                    "上传文件",
                    "FILE",
                    fileInfo.getId(),
                    fileInfo.getDisplayName(),
                    "文件大小: " + FileUtil.readableFileSize(fileInfo.getSize())
            );

            cacheManager.cleanTask(taskId);

            // 推送完成事件
            transferSseService.sendCompleteEvent(task.getUserId(), taskId,
                    fileInfo.getId(), fileInfo.getOriginalName(), fileInfo.getSize());

            log.info("分片合并成功: taskId={}, fileId={}, fileName={}", taskId, fileInfo.getId(), fileInfo.getOriginalName());

            return fileInfo;

        } catch (Exception e) {
            log.error("分片合并失败: taskId={}", taskId, e);

            // 推送错误事件
            if (task != null) {
                String userFriendlyMsg = ErrorMessageUtils.extractUserFriendlyMessage(e);
                transferSseService.sendErrorEvent(task.getUserId(), taskId,
                        "MERGE_FAILED", "task.merge.failed");
            }

            throw new StorageOperationException(ErrorMessages.TASK_MERGE_FAILED, e);
        }
    }

    private FileInfo persistUploaded(FileTransferTask task, FileInfo fileInfo) {
        if (storageMountService.isS3Container(task.getParentId())) {
            fileInfo.setId(storageMountService.liveNodeId(task.getStoragePlatformSettingId(), fileInfo.getObjectKey()));
            return fileInfo;
        }
        fileInfoService.save(fileInfo);
        return fileInfo;
    }

    private FileInfo buildUploadedFileInfo(FileTransferTask task, String objectKey, LocalDateTime completeTime) {
        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(IdUtil.fastSimpleUUID());
        fileInfo.setObjectKey(objectKey);
        fileInfo.setOriginalName(task.getFileName());
        fileInfo.setDisplayName(task.getFileName());
        fileInfo.setSuffix(task.getSuffix());
        fileInfo.setSize(task.getFileSize());
        fileInfo.setMimeType(task.getMimeType());
        fileInfo.setIsDir(false);
        fileInfo.setParentId(task.getParentId());
        fileInfo.setWorkspaceId(task.getWorkspaceId());
        fileInfo.setUserId(task.getUserId());
        fileInfo.setContentMd5(task.getFileMd5());
        fileInfo.setStoragePlatformSettingId(task.getStoragePlatformSettingId());
        fileInfo.setUploadTime(completeTime);
        fileInfo.setUpdateTime(completeTime);
        fileInfo.setIsDeleted(false);
        return fileInfo;
    }

    private FileTransferTask getTaskFromCacheOrDB(String taskId) {
        FileTransferTask task = cacheManager.getTaskFromCache(taskId);
        if (task == null) {
            task = fileTransferTaskMapper.selectByTaskId(taskId);
            if (task == null) {
                throw new BusinessException(ErrorMessages.TASK_NOT_EXIST);
            }
            // 缓存到 Redis
            cacheManager.cacheTask(task);
        }
        return task;
    }

    private FileTransferTask getAuthorizedTask(String taskId) {
        if (StringUtils.isBlank(taskId)) {
            throw new BusinessException(ErrorMessages.TASK_ID_EMPTY);
        }
        FileTransferTask task = getTaskFromCacheOrDB(taskId);
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (!Objects.equals(userId, task.getUserId()) || !Objects.equals(workspaceId, task.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        return task;
    }

    /**
     * 验证状态转换是否合法
     *
     * @param currentStatus 当前状态
     * @param newStatus     目标状态
     * @throws BusinessException 如果状态转换不合法
     */
    private void validateStateTransition(TransferTaskStatus currentStatus, TransferTaskStatus newStatus) {
        com.xddcodec.fs.file.transfer.TransferTaskRules.requireTransition(currentStatus, newStatus);
    }

    /**
     * 更新任务状态（数据库 + 缓存）
     */
    private void updateTaskStatus(FileTransferTask task, TransferTaskStatus newStatus) {
        // 验证状态转换合法性
        validateStateTransition(task.getStatus(), newStatus);

        task.setStatus(newStatus);
        task.setUpdatedAt(LocalDateTime.now());
        fileTransferTaskMapper.updateById(task);
        cacheManager.cacheTask(task);
        cacheManager.updateTaskStatus(task.getTaskId(), newStatus);
    }

    /**
     * 计算分片总数
     *
     * @param fileSize  文件大小（字节）
     * @param chunkSize 分片大小（字节）
     * @return 分片总数
     */

    @Override
    public void clearTransfers() {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();

        List<FileTransferTask> tasks = fileTransferTaskMapper.selectCompletedTransfers(
                userId, workspaceId, storagePlatformSettingId);

        if (tasks.isEmpty()) {
            return;
        }

        fileTransferTaskMapper.deleteCompletedTransfers(userId, workspaceId, storagePlatformSettingId);

        List<String> taskIds = tasks.stream()
                .map(FileTransferTask::getTaskId)
                .collect(Collectors.toList());

        //清除缓存
        cacheManager.cleanTasks(taskIds);
    }

    /**
     * 合并任务通常在异步线程完成，不能依赖当前请求线程的 Sa-Token 会话；
     * 因此按任务中的用户 ID 查询稳定的用户名，避免把 ULID 当作操作人名称。
     */
    private String resolveOperatorName(String userId) {
        if (StringUtils.isEmpty(userId)) {
            return userId;
        }
        try {
            SysUser user = sysUserService.getById(userId);
            if (user != null) {
                if (StringUtils.isNotEmpty(user.getUsername())) {
                    return user.getUsername();
                }
                if (StringUtils.isNotEmpty(user.getNickname())) {
                    return user.getNickname();
                }
            }
        } catch (Exception e) {
            log.warn("查询操作日志用户名失败: userId={}", userId, e);
        }
        return userId;
    }

    @Override
    public FileDownloadVO downloadFile(String fileId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileInfo fileInfo = folderDownloadService.resolveDownloadFile(fileId);
        if (fileInfo == null) {
            throw new BusinessException(ErrorMessages.FILE_DOWNLOAD_FAILED_NOT_EXIST);
        }
        if (!workspaceId.equals(fileInfo.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        if (Boolean.TRUE.equals(fileInfo.getIsDir())) {
            return folderDownloadService.downloadDirectory(fileInfo);
        }
        IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());
        if (!storageService.isFileExist(fileInfo.getObjectKey())) {
            throw new BusinessException(ErrorMessages.FILE_DOWNLOAD_FAILED_NOT_EXIST);
        }
        InputStream inputStream = storageService.downloadFile(fileInfo.getObjectKey());
        InputStreamResource resource = new InputStreamResource(inputStream);
        FileDownloadVO downloadVO = new FileDownloadVO();
        downloadVO.setFileName(fileInfo.getDisplayName());
        downloadVO.setFileSize(fileInfo.getSize());
        downloadVO.setResource(resource);
        return downloadVO;
    }

    @Override
    public FolderDownloadTaskVO createFolderDownloadTask(String folderId) {
        return folderDownloadService.createFolderDownloadTask(folderId);
    }

    @Override
    public FolderDownloadTaskVO getFolderDownloadTask(String taskId) {
        return folderDownloadService.getFolderDownloadTask(taskId);
    }

    @Override
    public void cancelFolderDownloadTask(String taskId) {
        folderDownloadService.cancelFolderDownloadTask(taskId);
    }

    @Override
    public FileDownloadVO downloadFolderTaskFile(String taskId) {
        return folderDownloadService.downloadFolderTaskFile(taskId);
    }


    /**
     * 获取已下载的分片列表
     *
     * @param taskId 任务ID
     * @return 已下载分片索引集合
     * @author xddcode
     */
    @Override
    public Set<Integer> getDownloadedChunks(String taskId) {
        try {
            getAuthorizedTask(taskId);
            String chunksKey = "download:chunks:" + taskId;
            Set<Object> chunks = cacheManager.sGet(chunksKey);

            if (chunks == null || chunks.isEmpty()) {
                return Collections.emptySet();
            }

            // 转换为 Integer Set
            Set<Integer> result = new HashSet<>();
            for (Object chunk : chunks) {
                if (chunk instanceof Integer) {
                    result.add((Integer) chunk);
                } else {
                    try {
                        result.add(Integer.parseInt(chunk.toString()));
                    } catch (NumberFormatException e) {
                        log.error("解析分片索引失败: chunk={}", chunk, e);
                    }
                }
            }

            log.debug("查询已下载分片: taskId={}, count={}", taskId, result.size());
            return result;

        } catch (Exception e) {
            log.error("查询已下载分片失败: taskId={}", taskId, e);
            return Collections.emptySet();
        }
    }

    @Override
    public FileTransferTask getTask(String taskId) {
        return getAuthorizedTask(taskId);
    }

    @Override
    public void save(FileTransferTask task) {
        fileTransferTaskMapper.insert(task);
    }

    @Override
    public void updateById(FileTransferTask task) {
        fileTransferTaskMapper.updateById(task);
    }

    @Override
    public FileTransferTask getByTaskId(String taskId) {
        return fileTransferTaskMapper.selectByTaskId(taskId);
    }

    @Override
    public long countByCollectionSubmissionId(String collectionSubmissionId) {
        return fileTransferTaskMapper.countByCollectionSubmissionId(collectionSubmissionId);
    }

    @Override
    public List<FileTransferTask> listCompletedOrCanceledBefore(LocalDateTime before) {
        return fileTransferTaskMapper.selectCompletedOrCanceledBefore(before);
    }

    @Override
    public List<FileTransferTask> listFailedBefore(LocalDateTime before) {
        return fileTransferTaskMapper.selectFailedBefore(before);
    }

    @Override
    public List<FileTransferTask> listInactiveBefore(LocalDateTime before) {
        return fileTransferTaskMapper.selectInactiveBefore(before);
    }

    @Override
    public void removeByIds(List<FileTransferTask> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return;
        }
        List<Long> ids = tasks.stream()
                .map(FileTransferTask::getId)
                .filter(Objects::nonNull)
                .toList();
        if (ids.isEmpty()) {
            return;
        }
        fileTransferTaskMapper.deleteByIds(ids);
    }

}
