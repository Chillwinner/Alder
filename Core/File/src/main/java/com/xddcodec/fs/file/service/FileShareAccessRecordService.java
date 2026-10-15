/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileShareAccessRecord;
import com.xddcodec.fs.File.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.File.domain.vo.FileShareAccessRecordVO;

import java.util.List;

/**
 * 分享访问记录服务接口
 *
 * @Author: xddcode
 * @Date: 2025/10/30 9:35
 */
public interface FileShareAccessRecordService {

    /**
     * 根据分享ID获取访问记录列表
     *
     * @param shareId
     * @return
     */
    List<FileShareAccessRecordVO> getListByShareId(String shareId);


    /**
     * 新增分享访问记录
     *
     * @param cmd
     */
    void addShareAccessRecord(CreateFileShareAccessRecordCmd cmd);
}
