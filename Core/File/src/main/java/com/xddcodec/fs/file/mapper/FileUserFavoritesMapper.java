/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import com.xddcodec.fs.File.domain.FileUserFavorites;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/**
 * 用户收藏文件数据访问层接口
 *
 * @Author: xddcode
 * @Date: 2025/5/12 13:49
 */
public interface FileUserFavoritesMapper {
    int insertBatch(@Param("list") List<FileUserFavorites> list);


    List<FileUserFavorites> selectByFileIdsAndUserId(@Param("fileIds") Collection<String> fileIds,
                                                     @Param("userId") String userId);

    int deleteByFileIdsAndUserId(@Param("fileIds") Collection<String> fileIds,
                                 @Param("userId") String userId);

    int deleteByFileIds(@Param("fileIds") Collection<String> fileIds);

    long countFavorites(@Param("userId") String userId,
                        @Param("workspaceId") String workspaceId,
                        @Param("storagePlatformSettingId") String storagePlatformSettingId);
}
