/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.File.domain.FileShareAccessRecord;
import com.xddcodec.fs.File.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.File.domain.vo.FileShareAccessRecordVO;
import com.xddcodec.fs.file.mapper.FileShareAccessRecordMapper;
import com.xddcodec.fs.file.service.FileShareAccessRecordService;
import org.apache.commons.lang3.StringUtils;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 分享访问记录服务实现
 *
 * @Author: xddcode
 * @Date: 2025/10/30 9:35
 */
@Service
@RequiredArgsConstructor
public class FileShareAccessRecordServiceImpl implements FileShareAccessRecordService {

    private final FileShareAccessRecordMapper fileShareAccessRecordMapper;
    private final Converter converter;

    @Override
    public List<FileShareAccessRecordVO> getListByShareId(String shareId) {
        List<FileShareAccessRecord> records = fileShareAccessRecordMapper.selectByShareId(shareId);
        return converter.convert(records, FileShareAccessRecordVO.class);
    }

    @Override
    public void addShareAccessRecord(CreateFileShareAccessRecordCmd cmd) {
        if (StringUtils.isEmpty(cmd.getShareId())) {
            return;
        }
        FileShareAccessRecord record = converter.convert(cmd, FileShareAccessRecord.class);
        record.setAccessTime(LocalDateTime.now());
        fileShareAccessRecordMapper.insert(record);
    }
}
