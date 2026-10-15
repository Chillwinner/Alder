/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.service.impl;

import com.xddcodec.fs.Storage.domain.StoragePlatform;
import com.xddcodec.fs.Storage.domain.vo.StoragePlatformVO;
import com.xddcodec.fs.storage.mapper.StoragePlatformMapper;
import com.xddcodec.fs.storage.service.StoragePlatformService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 存储平台业务接口实现
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:38
 */
@Service
@RequiredArgsConstructor
public class StoragePlatformServiceImpl implements StoragePlatformService {

    private final StoragePlatformMapper storagePlatformMapper;
    private final Converter converter;

    @Override
    public List<StoragePlatformVO> getList() {
        return converter.convert(storagePlatformMapper.selectAll(), StoragePlatformVO.class);
    }

    @Override
    @Cacheable(value = "storagePlatform", key = "#identifier", unless = "#result == null")
    public StoragePlatform getStoragePlatformByIdentifier(String identifier) {
        return storagePlatformMapper.selectByIdentifier(identifier);
    }
}
