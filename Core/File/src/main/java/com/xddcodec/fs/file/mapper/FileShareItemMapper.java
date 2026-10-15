/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import com.xddcodec.fs.File.domain.FileShareItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Collection;
import java.util.List;

/**
 * 分享文件关联数据访问层接口
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
@Mapper
public interface FileShareItemMapper {
    int insert(FileShareItem row);


    @Delete("DELETE FROM file_share_items WHERE share_id = #{shareId}")
    int deleteByShareId(@Param("shareId") String shareId);

    int deleteByShareIds(@Param("shareIds") Collection<String> shareIds);

    @Select("SELECT COUNT(1) FROM file_share_items WHERE share_id = #{shareId}")
    long countByShareId(@Param("shareId") String shareId);

    @Select("SELECT file_id FROM file_share_items WHERE share_id = #{shareId}")
    List<String> selectFileIdsByShareId(@Param("shareId") String shareId);

    @Select("SELECT COUNT(1) FROM file_share_items WHERE share_id = #{shareId} AND file_id = #{fileId}")
    long countByShareAndFile(@Param("shareId") String shareId, @Param("fileId") String fileId);
}
