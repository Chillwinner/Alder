/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.common.utils;

import cn.hutool.core.io.IoUtil;
import cn.hutool.core.util.StrUtil;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.lionsoul.ip2region.xdb.Searcher;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;

@Slf4j
@Component
public class Ip2RegionUtils {

    private static final String DB_PATH = "ip2region_v4.xdb";

    private static Searcher searcher;

    @PostConstruct
    public void init() {
        try {
            ClassPathResource resource = new ClassPathResource(DB_PATH);
            InputStream inputStream = resource.getInputStream();
            byte[] bytes = IoUtil.readBytes(inputStream);
            searcher = Searcher.newWithBuffer(bytes);
        } catch (Exception e) {
            log.error("IP2Region 初始化失败: {}", e.getMessage(), e);
        }
    }

    @PreDestroy
    public void destroy() {
        if (searcher != null) {
            try {
                searcher.close();
            } catch (Exception e) {
                log.error("关闭 IP2Region 失败: {}", e.getMessage(), e);
            }
        }
    }

    public static String search(String ip) {
        if (StrUtil.isBlank(ip) || searcher == null) {
            return "未知";
        }
        try {
            return searcher.search(ip);
        } catch (Exception e) {
            log.error("查询 IP [{}] 归属地失败: {}", ip, e.getMessage());
            return "未知";
        }
    }
}
