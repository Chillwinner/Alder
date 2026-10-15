/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.transfer;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.File.enums.TransferTaskStatus;

/**
 * 传输任务状态机。不碰数据库和缓存，只回答「能不能转到这个状态」。
 */
public final class TransferTaskRules {

    private TransferTaskRules() {
    }

    public static void requireTransition(TransferTaskStatus currentStatus, TransferTaskStatus newStatus) {
        if (currentStatus == newStatus) {
            return;
        }
        if (!canTransition(currentStatus, newStatus)) {
            throw new BusinessException(ErrorMessages.TASK_STATUS_TRANSITION_INVALID);
        }
    }

    public static boolean canTransition(TransferTaskStatus currentStatus, TransferTaskStatus newStatus) {
        if (currentStatus == null || newStatus == null) {
            return false;
        }
        if (currentStatus == newStatus) {
            return true;
        }
        return switch (currentStatus) {
            case initialized -> newStatus == TransferTaskStatus.checking
                    || newStatus == TransferTaskStatus.failed
                    || newStatus == TransferTaskStatus.canceled;
            case checking -> newStatus == TransferTaskStatus.uploading
                    || newStatus == TransferTaskStatus.completed
                    || newStatus == TransferTaskStatus.failed
                    || newStatus == TransferTaskStatus.canceled;
            case uploading -> newStatus == TransferTaskStatus.paused
                    || newStatus == TransferTaskStatus.merging
                    || newStatus == TransferTaskStatus.failed
                    || newStatus == TransferTaskStatus.canceled;
            case paused -> newStatus == TransferTaskStatus.uploading
                    || newStatus == TransferTaskStatus.downloading
                    || newStatus == TransferTaskStatus.canceled;
            case merging -> newStatus == TransferTaskStatus.completed
                    || newStatus == TransferTaskStatus.failed;
            case failed -> newStatus == TransferTaskStatus.initialized;
            case downloading -> newStatus == TransferTaskStatus.paused
                    || newStatus == TransferTaskStatus.completed
                    || newStatus == TransferTaskStatus.failed
                    || newStatus == TransferTaskStatus.canceled;
            case completed, canceled -> false;
        };
    }

    public static int totalChunks(Long fileSize, Long chunkSize) {
        if (fileSize == null || fileSize <= 0) {
            throw new BusinessException(ErrorMessages.TASK_FILE_SIZE_INVALID);
        }
        if (chunkSize == null || chunkSize <= 0) {
            throw new BusinessException(ErrorMessages.TASK_CHUNK_SIZE_INVALID);
        }
        return (int) Math.ceil((double) fileSize / chunkSize);
    }
}
