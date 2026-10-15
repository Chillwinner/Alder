/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.mapper;

import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Select;
import com.xddcodec.fs.Storage.domain.StorageSetting;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 存储平台配置 Mapper 接口
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:36
 */
public interface StorageSettingMapper {
    @Select("SELECT * FROM storage_settings WHERE id = #{id} AND deleted = 0")
    StorageSetting selectById(@Param("id") String id);

    @Update("UPDATE storage_settings SET deleted = 1 WHERE id = #{id}")
    int deleteById(@Param("id") String id);

    int insert(StorageSetting row);

    int updateById(StorageSetting row);


    @Select("SELECT * FROM storage_settings WHERE deleted = 0")
    List<StorageSetting> selectAllActive();

    @Select("SELECT * FROM storage_settings WHERE workspace_id = #{workspaceId} AND deleted = 0 ORDER BY enabled DESC")
    List<StorageSetting> selectByWorkspaceId(@Param("workspaceId") String workspaceId);

    @Select("SELECT * FROM storage_settings WHERE enabled = #{enabled} AND workspace_id = #{workspaceId} AND deleted = 0 LIMIT 1")
    StorageSetting selectEnabledByWorkspaceId(@Param("workspaceId") String workspaceId,
                                              @Param("enabled") Integer enabled);

    @Select("SELECT * FROM storage_settings WHERE workspace_id = #{workspaceId} AND enabled = #{enabled} AND deleted = 0")
    List<StorageSetting> selectEnabledListByWorkspaceId(@Param("workspaceId") String workspaceId,
                                                        @Param("enabled") Integer enabled);

    @Select("SELECT * FROM storage_settings WHERE workspace_id = #{workspaceId} AND platform_identifier = #{platformIdentifier} AND deleted = 0")
    List<StorageSetting> selectByWorkspaceAndPlatform(@Param("workspaceId") String workspaceId,
                                                      @Param("platformIdentifier") String platformIdentifier);

    @Select("SELECT * FROM storage_settings WHERE workspace_id = #{workspaceId} AND platform_identifier = #{platformIdentifier} AND id != #{excludeId} AND deleted = 0")
    List<StorageSetting> selectByWorkspaceAndPlatformExcludeId(@Param("workspaceId") String workspaceId,
                                                               @Param("platformIdentifier") String platformIdentifier,
                                                               @Param("excludeId") String excludeId);

    @Select("SELECT * FROM storage_settings WHERE platform_identifier = #{platformIdentifier} AND workspace_id = #{workspaceId} AND enabled = #{enabled} AND deleted = 0")
    List<StorageSetting> selectEnabledByWorkspaceAndPlatform(@Param("workspaceId") String workspaceId,
                                                             @Param("platformIdentifier") String platformIdentifier,
                                                             @Param("enabled") Integer enabled);

    @Update("UPDATE storage_settings SET platform_identifier = #{toIdentifier} WHERE platform_identifier = #{fromIdentifier} AND deleted = 0")
    int migratePlatformIdentifier(@Param("fromIdentifier") String fromIdentifier,
                                  @Param("toIdentifier") String toIdentifier);
}
