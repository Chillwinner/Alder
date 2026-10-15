/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.collection.CollUtil;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileUserFavorites;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.mapper.FileUserFavoritesMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileUserFavoritesService;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Context.StorageContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 用户收藏文件服务实现类
 *
 * @Author: xddcode
 * @Date: 2025/5/12 13:50
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileUserFavoritesServiceImpl implements FileUserFavoritesService {

    private final FileUserFavoritesMapper fileUserFavoritesMapper;
    private final FileInfoMapper fileInfoMapper;
    private final FileInfoService fileInfoService;

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void favoritesFile(List<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) {
            throw new BusinessException(ErrorMessages.FILE_FAVORITES_EMPTY);
        }
        List<String> distinctFileIds = fileIds.stream().distinct().collect(Collectors.toList());
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<FileInfo> fileInfos = fileInfoMapper.selectByIdsAndWorkspaceDeleted(
                distinctFileIds, workspaceId, false);
        if (fileInfos.isEmpty()) {
            throw new BusinessException(ErrorMessages.FILE_FAVORITES_NOT_FOUND);
        }
        // 查询已收藏的文件
        List<FileUserFavorites> existingFavorites = fileUserFavoritesMapper
                .selectByFileIdsAndUserId(fileIds, userId);
        Set<String> existingFileIds = existingFavorites.stream()
                .map(FileUserFavorites::getFileId)
                .collect(Collectors.toSet());
        // 过滤掉已收藏的文件
        List<FileUserFavorites> favoritesToAdd = fileInfos.stream()
                .filter(fileInfo -> !existingFileIds.contains(fileInfo.getId()))
                .map(fileInfo -> {
                    FileUserFavorites favoritesFile = new FileUserFavorites();
                    favoritesFile.setWorkspaceId(workspaceId);
                    favoritesFile.setFileId(fileInfo.getId());
                    favoritesFile.setUserId(userId);
                    favoritesFile.setFavoriteTime(LocalDateTime.now());
                    return favoritesFile;
                })
                .collect(Collectors.toList());
        if (favoritesToAdd.isEmpty()) {
            log.info("用户 {} 的文件已全部收藏，fileIds: {}", userId, fileIds);
            return;
        }
        fileUserFavoritesMapper.insertBatch(favoritesToAdd);

        // 修改访问时间
        LocalDateTime now = LocalDateTime.now();
        List<String> fileIdsToUpdate = favoritesToAdd.stream()
                .map(FileUserFavorites::getFileId)
                .collect(Collectors.toList());

        fileIdsToUpdate.forEach(fileId -> {
            FileInfo fileInfo = new FileInfo();
            fileInfo.setId(fileId);
            fileInfo.setLastAccessTime(now);
            fileInfoService.updateById(fileInfo);
        });

        log.info("用户 {} 成功收藏 {} 个文件，并更新了访问时间", userId, favoritesToAdd.size());
    }

    @Override
    public void unFavoritesFile(List<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) {
            return;
        }

        String userId = UserContext.getUserId();
        List<String> distinctFileIds = fileIds.stream().distinct().collect(Collectors.toList());

        // 删除收藏记录
        fileUserFavoritesMapper.deleteByFileIdsAndUserId(distinctFileIds, userId);

        // 修改访问时间
        LocalDateTime now = LocalDateTime.now();
        distinctFileIds.forEach(fileId -> {
            FileInfo fileInfo = new FileInfo();
            fileInfo.setId(fileId);
            fileInfo.setLastAccessTime(now);
            fileInfoService.updateById(fileInfo);
        });

        log.info("用户 {} 成功取消收藏 {} 个文件，并更新了访问时间", userId, distinctFileIds.size());
    }

    @Override
    public void removeByFileIds(Collection<String> fileIds, String userId) {
        if (CollUtil.isEmpty(fileIds)) {
            return;
        }
        fileUserFavoritesMapper.deleteByFileIdsAndUserId(fileIds, userId);
    }

    @Override
    public void removeByFileIds(Collection<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) {
            return;
        }
        fileUserFavoritesMapper.deleteByFileIds(fileIds);
    }

    @Override
    public Long getFavoritesCount() {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();
        return fileUserFavoritesMapper.countFavorites(userId, workspaceId, storagePlatformSettingId);
    }
}
