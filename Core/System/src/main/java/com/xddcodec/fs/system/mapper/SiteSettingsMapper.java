package com.xddcodec.fs.system.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface SiteSettingsMapper {

    @Select("SELECT setting_key, setting_value FROM site_settings")
    List<Map<String, Object>> selectAll();

    @Update("""
            INSERT INTO site_settings (setting_key, setting_value, updated_at)
            VALUES (#{key}, #{value}, now())
            ON CONFLICT (setting_key) DO UPDATE
            SET setting_value = EXCLUDED.setting_value, updated_at = now()
            """)
    int upsert(@Param("key") String key, @Param("value") String value);
}
