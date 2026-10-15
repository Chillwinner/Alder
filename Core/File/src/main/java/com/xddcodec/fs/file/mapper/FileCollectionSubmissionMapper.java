/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import com.xddcodec.fs.File.domain.FileCollectionSubmission;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

public interface FileCollectionSubmissionMapper {
    int insert(FileCollectionSubmission row);

    int updateById(FileCollectionSubmission row);


    @Update("UPDATE file_collection_submissions SET file_count = file_count + 1, total_size = total_size + #{fileSize}, updated_at = #{updatedAt} WHERE id = #{id}")
    int incrementFileStats(@Param("id") String id,
                           @Param("fileSize") long fileSize,
                           @Param("updatedAt") LocalDateTime updatedAt);

    @Select("SELECT COUNT(1) FROM file_collection_submissions WHERE collection_id = #{collectionId}")
    long countByCollectionId(@Param("collectionId") String collectionId);

    @Delete("DELETE FROM file_collection_submissions WHERE collection_id = #{collectionId}")
    int deleteByCollectionId(@Param("collectionId") String collectionId);

    @Select("SELECT * FROM file_collection_submissions WHERE id = #{id} AND collection_id = #{collectionId}")
    FileCollectionSubmission selectByIdAndCollectionId(@Param("id") String id,
                                                       @Param("collectionId") String collectionId);

    List<FileCollectionSubmission> selectPageByCollectionId(@Param("collectionId") String collectionId,
                                                            @Param("keyword") String keyword);

    @Select("SELECT DISTINCT submitter_user_id FROM file_collection_submissions "
            + "WHERE collection_id = #{collectionId} AND status = 'COMPLETED' "
            + "AND submitter_user_id IS NOT NULL")
    List<String> listCompletedSubmitterIds(@Param("collectionId") String collectionId);
}
