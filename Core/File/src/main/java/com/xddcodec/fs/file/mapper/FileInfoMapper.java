/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.vo.FileVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 文件资源Mapper接口
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:30
 */
@Mapper
public interface FileInfoMapper {
    @Select("SELECT * FROM file_info WHERE id = #{id}")
    FileInfo selectById(@Param("id") String id);

    int insert(FileInfo row);

    int updateById(FileInfo row);

    int insertBatch(@Param("list") List<FileInfo> list);

    List<FileInfo> selectByIds(@Param("ids") Collection<? extends java.io.Serializable> ids);


    FileInfo selectAuthorizedById(@Param("id") String id, @Param("workspaceId") String workspaceId);

    FileInfo selectByIdAndWorkspace(@Param("id") String id, @Param("workspaceId") String workspaceId);

    List<FileInfo> selectByIdsAndWorkspace(@Param("ids") Collection<String> ids,
                                           @Param("workspaceId") String workspaceId);

    List<FileInfo> selectByIdsAndWorkspaceDeleted(@Param("ids") Collection<String> ids,
                                                  @Param("workspaceId") String workspaceId,
                                                  @Param("isDeleted") Boolean isDeleted);

    List<FileInfo> selectChildren(@Param("parentId") String parentId,
                                  @Param("workspaceId") String workspaceId,
                                  @Param("isDeleted") Boolean isDeleted);

    List<FileInfo> selectChildrenOrderedByDirAndUpdate(@Param("parentId") String parentId,
                                                       @Param("workspaceId") String workspaceId);

    List<FileInfo> selectChildrenOrderedByDirAndUpload(@Param("parentId") String parentId,
                                                       @Param("workspaceId") String workspaceId);

    FileInfo selectSameLevelExactName(@Param("workspaceId") String workspaceId,
                                      @Param("parentId") String parentId,
                                      @Param("displayName") String displayName,
                                      @Param("isDir") Boolean isDir,
                                      @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<FileInfo> selectSameLevelByDisplayName(@Param("workspaceId") String workspaceId,
                                                @Param("parentId") String parentId,
                                                @Param("baseName") String baseName,
                                                @Param("isDir") Boolean isDir,
                                                @Param("excludeFileId") String excludeFileId,
                                                @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<FileVO> selectFileList(@Param("userId") String userId,
                                @Param("workspaceId") String workspaceId,
                                @Param("storagePlatformSettingId") String storagePlatformSettingId,
                                @Param("parentId") String parentId,
                                @Param("keyword") String keyword,
                                @Param("isFavorite") Boolean isFavorite,
                                @Param("isRecents") Boolean isRecents,
                                @Param("isDir") Boolean isDir,
                                @Param("applyParentFilter") Boolean applyParentFilter,
                                @Param("orderByField") String orderByField,
                                @Param("isAsc") Boolean isAsc,
                                @Param("suffixes") List<String> suffixes,
                                @Param("excludeSuffixes") List<String> excludeSuffixes,
                                @Param("filterMode") String filterMode);

    List<FileInfo> selectUsedFiles(@Param("workspaceId") String workspaceId,
                                   @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<FileVO> selectDirs(@Param("workspaceId") String workspaceId,
                            @Param("storagePlatformSettingId") String storagePlatformSettingId,
                            @Param("parentId") String parentId);

    List<FileInfo> selectByIdsNotDeleted(@Param("ids") Collection<String> ids);

    List<FileInfo> selectReusableByContent(@Param("contentMd5") String contentMd5,
                                           @Param("size") Long size,
                                           @Param("storageSettingId") String storageSettingId);

    long countByObjectKey(@Param("objectKey") String objectKey,
                          @Param("storageSettingId") String storageSettingId);

    List<FileInfo> selectExpiredRecycle(@Param("expireTime") LocalDateTime expireTime);

    List<FileInfo> selectUploadStats(@Param("workspaceId") String workspaceId,
                                     @Param("storagePlatformSettingId") String storagePlatformSettingId,
                                     @Param("startTime") LocalDateTime startTime,
                                     @Param("endTime") LocalDateTime endTime);

    List<FileInfo> selectDirectoryChildren(@Param("parentId") String parentId,
                                           @Param("workspaceId") String workspaceId,
                                           @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<String> selectParentIds(@Param("ids") Collection<String> ids,
                                 @Param("workspaceId") String workspaceId);

    List<String> selectDeletedIds(@Param("ids") Collection<String> ids);

    List<String> selectTopLevelRecycleIds(@Param("workspaceId") String workspaceId,
                                          @Param("storagePlatformSettingId") String storagePlatformSettingId);

    List<FileInfo> selectRecyclePage(@Param("workspaceId") String workspaceId,
                                     @Param("storagePlatformSettingId") String storagePlatformSettingId,
                                     @Param("keyword") String keyword);

    int markDeletedByIds(@Param("ids") Collection<String> ids,
                         @Param("deletedTime") LocalDateTime deletedTime);

    int restoreByIds(@Param("ids") Collection<String> ids,
                     @Param("workspaceId") String workspaceId);

    int updateParentAndName(@Param("id") String id,
                            @Param("parentId") String parentId,
                            @Param("displayName") String displayName,
                            @Param("updateTime") LocalDateTime updateTime);

    int deleteByIds(@Param("ids") Collection<String> ids);
}
