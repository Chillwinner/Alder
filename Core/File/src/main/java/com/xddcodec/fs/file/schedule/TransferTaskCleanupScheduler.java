/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.schedule;

import cn.hutool.core.util.StrUtil;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.file.cache.TransferTaskCacheManager;
import com.xddcodec.fs.File.domain.FileTransferTask;
import com.xddcodec.fs.File.enums.TransferTaskType;
import com.xddcodec.fs.file.service.FileTransferTaskService;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 传输任务清理定时任务
 * 
 * 定期清理过期的传输任务记录和缓存
 * 
 * @author xddcode
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TransferTaskCleanupScheduler {

    private final FileTransferTaskService fileTransferTaskService;
    private final TransferTaskCacheManager cacheManager;
    private final StorageServiceFacade storageServiceFacade;

    /**
     * 清理过期的传输任务记录
     * 
     * 每天凌晨2点执行，清理已完成/已取消/失败的任务（7天前）以及长时间未活动的任务（3天前）
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupExpiredTasks() {
        log.info("开始清理过期的传输任务记录");
        
        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime sevenDaysAgo = now.minusDays(7);
            LocalDateTime threeDaysAgo = now.minusDays(3);
            
            // 清理已完成或已取消的任务（7天前）
            List<FileTransferTask> completedOrCanceledTasks =
                    fileTransferTaskService.listCompletedOrCanceledBefore(sevenDaysAgo);
            
            if (!completedOrCanceledTasks.isEmpty()) {
                List<String> taskIds = completedOrCanceledTasks.stream()
                        .map(FileTransferTask::getTaskId)
                        .collect(Collectors.toList());
                
                fileTransferTaskService.removeByIds(completedOrCanceledTasks);
                cacheManager.cleanTasks(taskIds);
                
                log.info("清理已完成或已取消的任务: count={}", completedOrCanceledTasks.size());
            }
            
            // 清理失败的任务（7天前）
            List<FileTransferTask> failedTasks = fileTransferTaskService.listFailedBefore(sevenDaysAgo);
            
            if (!failedTasks.isEmpty()) {
                List<String> taskIds = failedTasks.stream()
                        .map(FileTransferTask::getTaskId)
                        .collect(Collectors.toList());
                
                fileTransferTaskService.removeByIds(failedTasks);
                cacheManager.cleanTasks(taskIds);
                
                log.info("清理失败的任务: count={}", failedTasks.size());
            }
            
            // 清理长时间未活动的未完成任务（3天前）
            List<FileTransferTask> inactiveTasks = fileTransferTaskService.listInactiveBefore(threeDaysAgo);
            
            if (!inactiveTasks.isEmpty()) {
                abortIncompleteMultipartUploads(inactiveTasks);
                List<String> taskIds = inactiveTasks.stream()
                        .map(FileTransferTask::getTaskId)
                        .collect(Collectors.toList());
                
                fileTransferTaskService.removeByIds(inactiveTasks);
                cacheManager.cleanTasks(taskIds);
                
                log.info("清理长时间未活动的任务: count={}", inactiveTasks.size());
            }
            
            int totalCleaned = completedOrCanceledTasks.size() + failedTasks.size() + inactiveTasks.size();
            log.info("传输任务清理完成: totalCleaned={}", totalCleaned);
            
        } catch (Exception e) {
            log.error("清理过期传输任务失败", e);
        }
    }

    private void abortIncompleteMultipartUploads(List<FileTransferTask> tasks) {
        for (FileTransferTask task : tasks) {
            if (!TransferTaskType.upload.equals(task.getTaskType())
                    || StrUtil.isBlank(task.getUploadId())
                    || StrUtil.isBlank(task.getObjectKey())) {
                continue;
            }
            try {
                WorkspaceContext.runIn(task.getWorkspaceId(), () -> {
                    IStorageOperationService storageService = storageServiceFacade
                            .getStorageService(task.getStoragePlatformSettingId());
                    if (storageServiceFacade.isLocal(task.getStoragePlatformSettingId())) {
                        storageService.deleteFile(task.getObjectKey());
                    } else {
                        storageServiceFacade.getS3(task.getStoragePlatformSettingId())
                                .abortMultipartUpload(task.getObjectKey(), task.getUploadId());
                    }
                });
            } catch (Exception e) {
                log.warn("清理过期分片上传失败: taskId={}, uploadId={}",
                        task.getTaskId(), task.getUploadId(), e);
            }
        }
    }
}
