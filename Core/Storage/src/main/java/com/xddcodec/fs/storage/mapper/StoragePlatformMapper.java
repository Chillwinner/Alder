/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Delete;
import java.util.List;
import com.xddcodec.fs.Storage.domain.StoragePlatform;
import org.apache.ibatis.annotations.Param;

/**
 * 存储平台 Mapper 接口
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:36
 */
public interface StoragePlatformMapper {
    @Delete("DELETE FROM storage_platform WHERE id = #{id}")
    int deleteById(@Param("id") Long id);

    @Select("SELECT * FROM storage_platform")
    List<StoragePlatform> selectAll();

    int insert(StoragePlatform row);

    int updateById(StoragePlatform row);


    @Select("SELECT * FROM storage_platform WHERE identifier = #{identifier}")
    StoragePlatform selectByIdentifier(@Param("identifier") String identifier);
}
