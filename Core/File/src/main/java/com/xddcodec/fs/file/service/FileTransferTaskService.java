/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

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

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public interface FileTransferTaskService {

    /**
     * 获取用户传输列表
     *
     * @return
     */
    List<FileTransferTaskVO> getTransferFiles(TransferFilesQry qry);

    /**
     * 初始化上传
     *
     * @param cmd 初始化上传命令
     * @return 任务ID
     */
    String initUpload(InitUploadCmd cmd);

    /**
     * 资源校验
     *
     * @param cmd
     */
    CheckUploadResultVO checkUpload(CheckUploadCmd cmd);

    long tusOffset(String taskId);

    long tusPatch(String taskId, long offset, InputStream inputStream, long length);

    /**
     * 上传分片
     *
     * @param fileBytes 分片文件字节数组
     * @param cmd       上传分片命令
     */
    void uploadChunk(byte[] fileBytes, UploadChunkCmd cmd);

    /**
     * 暂停传输
     *
     * @param taskId 任务ID
     */
    void pauseTransfer(String taskId);

    /**
     * 继续传输
     *
     * @param taskId 任务ID
     */
    void resumeTransfer(String taskId);

    /**
     * 合并分片
     *
     * @param taskId 合并分片任务ID
     * @return 文件信息
     */
    FileInfo mergeChunks(String taskId);

    /**
     * 获取该任务下已上传的分片
     *
     * @param taskId 上传任务ID
     * @return 已上传的分片索引集合
     */
    Set<Integer> getUploadedChunks(String taskId);

    /**
     * 取消传输
     *
     * @param taskId 任务ID
     */
    void cancelTransfer(String taskId);

    /**
     * 清空已完成传输列表
     */
    void clearTransfers();

    /**
     * 下载文件
     *
     * @param fileId 文件ID
     * @return
     */
    FileDownloadVO downloadFile(String fileId);

    /**
     * 创建文件夹下载打包任务
     *
     * @param folderId 文件夹ID
     * @return 任务进度
     */
    FolderDownloadTaskVO createFolderDownloadTask(String folderId);

    /**
     * 查询文件夹下载打包任务进度
     *
     * @param taskId 任务ID
     * @return 任务进度
     */
    FolderDownloadTaskVO getFolderDownloadTask(String taskId);

    /**
     * 取消文件夹下载打包任务
     *
     * @param taskId 任务ID
     */
    void cancelFolderDownloadTask(String taskId);

    /**
     * 下载已完成的文件夹压缩包
     *
     * @param taskId 任务ID
     * @return 下载文件
     */
    FileDownloadVO downloadFolderTaskFile(String taskId);

    /**
     * 获取已下载的分片列表（历史下载任务）
     */
    Set<Integer> getDownloadedChunks(String taskId);

    /**
     * 获取传输任务
     *
     * @param taskId 任务ID
     * @return 传输任务
     */
    FileTransferTask getTask(String taskId);

    void save(FileTransferTask task);

    void updateById(FileTransferTask task);

    FileTransferTask getByTaskId(String taskId);

    long countByCollectionSubmissionId(String collectionSubmissionId);

    List<FileTransferTask> listCompletedOrCanceledBefore(LocalDateTime before);

    List<FileTransferTask> listFailedBefore(LocalDateTime before);

    List<FileTransferTask> listInactiveBefore(LocalDateTime before);

    void removeByIds(List<FileTransferTask> tasks);
}
