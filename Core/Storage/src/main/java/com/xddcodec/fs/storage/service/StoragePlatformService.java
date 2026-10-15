/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.service;

import com.xddcodec.fs.Storage.domain.StoragePlatform;
import com.xddcodec.fs.Storage.domain.vo.StoragePlatformVO;

import java.util.List;

/**
 * 存储平台业务接口
 *
 * @Author: xddcode
 * @Date: 2024/10/25 14:37
 */
public interface StoragePlatformService {

    /**
     * 查询所有存储平台列表
     *
     * @return
     */
    List<StoragePlatformVO> getList();


    /**
     * 根据标识符查询存储平台
     *
     * @param identifier
     * @return
     */
    StoragePlatform getStoragePlatformByIdentifier(String identifier);
}
