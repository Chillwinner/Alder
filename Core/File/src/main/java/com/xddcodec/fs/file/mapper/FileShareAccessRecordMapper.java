/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.mapper;

import com.xddcodec.fs.File.domain.FileShareAccessRecord;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 分享问记录 mapper 接口
 *
 * @Author: xddcode
 * @Date: 2025/10/29 15:13
 */
public interface FileShareAccessRecordMapper {
    int insert(FileShareAccessRecord row);


    @Select("SELECT * FROM file_share_access_record WHERE share_id = #{shareId}")
    List<FileShareAccessRecord> selectByShareId(@Param("shareId") String shareId);
}
