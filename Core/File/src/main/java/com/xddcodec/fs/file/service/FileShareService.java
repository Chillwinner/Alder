/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileShare;
import com.xddcodec.fs.File.domain.dto.CreateShareCmd;
import com.xddcodec.fs.File.domain.dto.SaveShareToWorkspaceCmd;
import com.xddcodec.fs.File.domain.dto.VerifyShareCodeCmd;
import com.xddcodec.fs.File.domain.qry.FileShareQry;
import com.xddcodec.fs.File.domain.vo.FileDownloadVO;
import com.xddcodec.fs.File.domain.vo.FileShareThinVO;
import com.xddcodec.fs.File.domain.vo.FileShareVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.File.domain.vo.FolderDownloadTaskVO;
import com.xddcodec.fs.Framework.common.domain.PageResult;

import java.io.InputStream;
import java.util.List;

/**
 * 文件分享服务接口
 *
 * @Author: xddcode
 * @Date: 2025/10/30 9:35
 */
public interface FileShareService {

    /**
     * 分页查询我的分享
     *
     * @param qry
     * @return
     */
    PageResult<FileShareVO> getPages(FileShareQry qry);

    /**
     * 获取分享详情
     *
     * @param shareId 分享ID
     * @return
     */
    FileShareVO getDetail(String shareId);

    /**
     * 创建分享
     *
     * @param cmd 创建分享参数
     */
    FileShareVO createShare(CreateShareCmd cmd);

    /**
     * 确认分享属于该用户，且指定文件在该分享范围内。
     */
    void assertOwnedShareItem(String userId, String shareId, String fileId);

    /**
     * 取消分享
     *
     * @param ids 分享ID集合
     */
    void cancelShares(List<String> ids);

    /**
     * 取消所有分享
     */
    void cancelAllShares();

    /**
     * 校验提取码
     *
     * @param cmd
     */
    boolean verifyShareCode(VerifyShareCodeCmd cmd);

    /**
     * 获取文件分享页对象
     *
     * @param shareId 分享id
     * @return vo
     */
    FileShareThinVO getFileShareThinVO(String shareId);

    /**
     * 获取分享文件列表
     *
     * @param shareId  分享id
     * @param parentId 父目录id
     * @return
     */
    List<FileVO> getShareFileItems(String shareId, String parentId);

    boolean isShareFileAvailable(String shareId, String fileId);

    FileInfo requireShareAccessibleFile(String shareId, String fileId);

    InputStream openShareDownload(String shareId, String fileId);

    List<FileVO> listShareChildren(String shareId, String parentId);

    /**
     * 下载文件
     *
     * @param shareId 分享id
     * @param fileId  文件id
     */
    FileDownloadVO downloadFiles(String shareId, String fileId);

    FileDownloadVO previewFile(String shareId, String fileId);

    String getFileAccessUrl(String shareId, String fileId, Integer expireSeconds, boolean download);

    /**
     * 创建分享文件夹下载任务
     */
    FolderDownloadTaskVO createFolderDownloadTask(String shareId, String folderId);

    /**
     * 查询分享文件夹下载任务
     */
    FolderDownloadTaskVO getFolderDownloadTask(String shareId, String taskId);

    /**
     * 取消分享文件夹下载打包任务
     */
    void cancelFolderDownloadTask(String shareId, String taskId);

    /**
     * 下载分享文件夹压缩包
     */
    FileDownloadVO downloadFolderTaskFile(String shareId, String taskId);

    /**
     * 将分享内文件/文件夹保存到当前用户工作空间（同存储引用物理对象，跨存储则流式拷贝）。
     */
    FileInfo saveShareToWorkspace(SaveShareToWorkspaceCmd cmd);
}
