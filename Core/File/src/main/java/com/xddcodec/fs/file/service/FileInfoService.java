/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.File.domain.dto.CopyFileCmd;
import com.xddcodec.fs.File.domain.dto.MoveFileCmd;
import com.xddcodec.fs.File.domain.dto.RenameFileCmd;
import com.xddcodec.fs.File.domain.qry.FileQry;
import com.xddcodec.fs.File.domain.vo.FileDetailVO;
import com.xddcodec.fs.File.domain.vo.FileNameConflictVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.Framework.common.domain.PageResult;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 文件资源服务接口
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:35
 */
public interface FileInfoService {

    FileInfo getById(String id);

    void save(FileInfo fileInfo);

    void updateById(FileInfo fileInfo);

    List<FileInfo> listByIds(Collection<String> ids);

    void removeByIds(Collection<String> ids);

    List<FileInfo> listExpiredRecycle(LocalDateTime expireTime);

    /**
     * 获取当前工作空间内可访问的文件。
     */
    FileInfo getAuthorizedFile(String fileId);

    /**
     * 下载文件
     *
     * @param fileId 文件ID
     * @return 文件输入流
     */
    InputStream downloadFile(String fileId);

    /**
     * 获取文件访问URL
     *
     * @param fileId        文件ID
     * @param expireSeconds URL有效时间（秒），如果不支持或永久有效可为null或0
     * @return 文件访问URL
     */
    String getFileUrl(String fileId, Integer expireSeconds);

    /**
     * @param download true 时签名带附件下载头，浏览器会另存为
     */
    String getFileUrl(String fileId, Integer expireSeconds, boolean download);

    /**
     * 放入回收站
     *
     * @param fileIds 文件ID集合
     * @return 是否删除成功
     */
    void moveFilesToRecycleBin(List<String> fileIds);

    /**
     * 创建目录
     *
     * @param cmd 创建目录请求参数
     * @return
     */
    FileInfo createDirectory(CreateDirectoryCmd cmd);

    /**
     * 生成唯一的文件名（处理重名冲突）
     * <p>
     * - 如果不存在重名：返回原名称
     * - 如果存在重名：自动添加 (1), (2), (3)... 后缀
     *
     * @param userId                   用户ID
     * @param parentId                 父目录ID
     * @param desiredName              期望的文件名
     * @param isDir                    是否是文件夹
     * @param excludeFileId            排除的文件ID（可选，用于重命名场景）
     * @param storagePlatformSettingId 存储平台设置ID
     * @return 唯一的文件名
     */
    String generateUniqueName(String workspaceId, String parentId,
                              String desiredName, Boolean isDir,
                              String excludeFileId, String storagePlatformSettingId);

    /**
     * 同目录下是否已有同名且同后缀的未删除文件（大小写不敏感）。
     */
    boolean existsSameNameFile(String workspaceId, String parentId, String fileName,
                               String storagePlatformSettingId);

    List<FileNameConflictVO> listNameConflicts(String parentId, List<String> fileNames);

    /**
     * 重命名文件
     *
     * @param fileId 文件ID
     * @param cmd    重命名请求参数
     */
    void renameFile(String fileId, RenameFileCmd cmd);

    /**
     * 移动文件到指定目录
     *
     * @param cmd 移动文件请求参数
     */
    void moveFile(MoveFileCmd cmd);

    /**
     * 复制文件或文件夹到指定目录。
     * 复制只新增数据库引用，不重复上传物理对象。
     */
    List<FileInfo> copyFiles(CopyFileCmd cmd);

    /**
     * 获取目录层级
     *
     * @param dirId 目录ID
     * @return
     */
    List<FileVO> getDirectoryTreePath(String dirId);

    /**
     * 查询文件列表
     *
     * @param qry 查询参数（包含关键词、文件类型、分页参数等）
     * @return 分页结果
     */
    PageResult<FileVO> getList(FileQry qry);

    /**
     * 计算已使用的存储空间
     *
     * @return
     */
    Long calculateUsedStorage();

    /**
     * 查询文件详情
     *
     * @param fileId 文件ID
     * @return
     */
    FileDetailVO getFileDetails(String fileId);

    /**
     * 根据父目录ID查询目录列表
     *
     * @param parentId
     * @return
     */
    List<FileVO> getDirs(String parentId);

    /**
     * 列出目录下全部子项（文件 + 文件夹）
     */
    List<FileVO> listChildren(String parentId);

    /**
     * 根据文件ID列表查询文件信息
     *
     * @param fileIds
     * @return
     */
    List<FileVO> getByFileIds(List<String> fileIds);

    /**
     * 把输入流作为新文件写入当前工作空间（新 objectKey，不复用引用）。
     */
    FileInfo importStream(InputStream input, String fileName, String mimeType, Long size, String parentId);

    /**
     * 在当前工作空间新增文件记录，引用 source 已有物理对象（同存储配置、非目录）。
     */
    FileInfo createFileReferenceFrom(FileInfo source, String parentId, String targetStoragePlatformId);

    /**
     * 覆盖同一 objectKey 的内容并更新大小、修改时间。
     */
    FileInfo replaceFileContent(String fileId, byte[] bytes);
}
