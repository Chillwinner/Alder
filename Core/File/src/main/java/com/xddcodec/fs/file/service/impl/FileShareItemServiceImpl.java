/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.xddcodec.fs.File.domain.FileShareItem;
import com.xddcodec.fs.file.mapper.FileShareItemMapper;
import com.xddcodec.fs.file.service.FileShareItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FileShareItemServiceImpl implements FileShareItemService {

    private final FileShareItemMapper fileShareItemMapper;

    @Override
    public void saveShareItems(String shareId, List<String> fileIds) {
        for (String fileId : fileIds) {
            FileShareItem fileShareItem = new FileShareItem();
            fileShareItem.setShareId(shareId);
            fileShareItem.setFileId(fileId);
            fileShareItem.setCreatedAt(LocalDateTime.now());
            fileShareItemMapper.insert(fileShareItem);
        }
    }

    @Override
    public void removeByShareId(String shareId) {
        fileShareItemMapper.deleteByShareId(shareId);
    }

    @Override
    public void removeByShareIds(List<String> shareIds) {
        if (CollUtil.isEmpty(shareIds)) {
            return;
        }
        fileShareItemMapper.deleteByShareIds(shareIds);
    }

    @Override
    public Long countByShareId(String shareId) {
        return fileShareItemMapper.countByShareId(shareId);
    }

    @Override
    public List<String> getShareFileIds(String shareId) {
        return fileShareItemMapper.selectFileIdsByShareId(shareId);
    }

    @Override
    public boolean isFileInShare(String shareId, String fileId) {
        return fileShareItemMapper.countByShareAndFile(shareId, fileId) > 0;
    }
}
