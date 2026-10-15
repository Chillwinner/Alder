/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import org.apache.ibatis.annotations.Delete;
import com.xddcodec.fs.File.domain.FileTransferTask;
import com.xddcodec.fs.File.enums.TransferTaskStatus;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 上传任务 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2025/11/06 15:22
 */
public interface FileTransferTaskMapper {
    @Delete("DELETE FROM file_transfer_task WHERE id = #{id}")
    int deleteById(@Param("id") Long id);

    int insert(FileTransferTask row);

    int updateById(FileTransferTask row);


    /**
     * 原子更新状态（仅当当前状态为指定状态时才更新）
     * 用于防止重复合并
     */
    @Update("UPDATE file_transfer_task " +
            "SET status = #{newStatus}, updated_at = NOW() " +
            "WHERE task_id = #{taskId} AND status = #{currentStatus}")
    int updateStatusByTaskIdAndStatus(
            @Param("taskId") String taskId,
            @Param("newStatus") TransferTaskStatus newStatus,
            @Param("currentStatus") TransferTaskStatus currentStatus
    );

    /**
     * 原子完成文件收集上传任务。并发或重试时只允许一个请求更新统计。
     */
    @Update("UPDATE file_transfer_task " +
            "SET file_id = #{fileId}, status = #{completedStatus}, " +
            "uploaded_chunks = total_chunks, complete_time = #{completeTime}, " +
            "updated_at = #{completeTime} " +
            "WHERE task_id = #{taskId} AND status <> #{completedStatus}")
    int completeCollectionUpload(
            @Param("taskId") String taskId,
            @Param("fileId") String fileId,
            @Param("completedStatus") TransferTaskStatus completedStatus,
            @Param("completeTime") LocalDateTime completeTime
    );

    FileTransferTask selectByTaskId(@Param("taskId") String taskId);

    List<FileTransferTask> selectTransferList(@Param("userId") String userId,
                                              @Param("workspaceId") String workspaceId,
                                              @Param("storagePlatformSettingId") String storagePlatformSettingId,
                                              @Param("statusType") Integer statusType);

    List<FileTransferTask> selectCompletedTransfers(@Param("userId") String userId,
                                                    @Param("workspaceId") String workspaceId,
                                                    @Param("storagePlatformSettingId") String storagePlatformSettingId);

    int deleteCompletedTransfers(@Param("userId") String userId,
                                 @Param("workspaceId") String workspaceId,
                                 @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<FileTransferTask> selectCompletedOrCanceledBefore(@Param("before") LocalDateTime before);

    List<FileTransferTask> selectFailedBefore(@Param("before") LocalDateTime before);

    List<FileTransferTask> selectInactiveBefore(@Param("before") LocalDateTime before);

    int deleteByIds(@Param("ids") Collection<Long> ids);

    List<FileTransferTask> selectTerminalByCollection(@Param("collectionId") String collectionId,
                                                      @Param("workspaceId") String workspaceId);

    int deleteTerminalByCollection(@Param("collectionId") String collectionId,
                                   @Param("workspaceId") String workspaceId);

    long countByCollectionSubmissionId(@Param("collectionSubmissionId") String collectionSubmissionId);
}
