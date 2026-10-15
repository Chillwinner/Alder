/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Delete;
import com.xddcodec.fs.File.domain.FileCollection;
import com.xddcodec.fs.File.enums.FileCollectionStatus;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

public interface FileCollectionMapper {
    @Select("SELECT * FROM file_collections WHERE id = #{id}")
    FileCollection selectById(@Param("id") String id);

    @Delete("DELETE FROM file_collections WHERE id = #{id}")
    int deleteById(@Param("id") String id);

    int insert(FileCollection row);

    int updateById(FileCollection row);


    @Update("UPDATE file_collections SET submission_count = submission_count + 1, updated_at = #{updatedAt} WHERE id = #{id}")
    int incrementSubmissionCount(@Param("id") String id, @Param("updatedAt") LocalDateTime updatedAt);

    @Update("UPDATE file_collections SET file_count = file_count + 1, total_size = total_size + #{fileSize}, updated_at = #{updatedAt} WHERE id = #{id}")
    int incrementFileStats(@Param("id") String id,
                           @Param("fileSize") long fileSize,
                           @Param("updatedAt") LocalDateTime updatedAt);

    List<FileCollection> selectPage(@Param("workspaceId") String workspaceId,
                                    @Param("keyword") String keyword,
                                    @Param("status") FileCollectionStatus status,
                                    @Param("orderBy") String orderBy,
                                    @Param("isAsc") Boolean isAsc);

    @Select("SELECT * FROM file_collections WHERE id = #{id} AND workspace_id = #{workspaceId}")
    FileCollection selectByIdAndWorkspace(@Param("id") String id, @Param("workspaceId") String workspaceId);

    List<FileCollection> selectAssigned(
            @Param("workspaceId") String workspaceId,
            @Param("userId") String userId);
}
