/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.qry.FileRecycleQry;
import com.xddcodec.fs.File.domain.vo.FileRecycleVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileObjectReferenceService;
import com.xddcodec.fs.file.service.FileRecycleService;
import com.xddcodec.fs.file.service.FileUserFavoritesService;
import com.xddcodec.fs.file.service.WorkspaceRagAccess;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.Context.StorageContext;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 回收站服务接口实现
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:35
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileRecycleServiceImpl implements FileRecycleService {

    private final Converter converter;

    private final FileInfoService fileInfoService;

    private final FileInfoMapper fileInfoMapper;

    private final FileUserFavoritesService fileUserFavoritesService;

    private final FileObjectReferenceService objectReferenceService;

    private final WorkspaceRagAccess workspaceRagAccess;

    @Override
    public PageResult<FileRecycleVO> getRecyclePages(FileRecycleQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String configId = StorageContext.getConfigId();
        int pageNum = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 10 : qry.getPageSize();
        String keyword = StrUtil.isNotBlank(qry.getKeyword()) ? qry.getKeyword().trim() : null;

        Pages.start(pageNum, pageSize);
        List<FileInfo> records = fileInfoMapper.selectRecyclePage(workspaceId, configId, keyword);
        List<FileRecycleVO> voList = converter.convert(records, FileRecycleVO.class);
        return PageResult.success(voList, new PageInfo<>(records).getTotal());
    }


    @Override
    @Transactional(rollbackFor = Exception.class)
    public void restoreFiles(List<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) return;
        String workspaceId = WorkspaceContext.getWorkspaceId();

        Set<String> allIdsToRestore = collectFileIdsRecursively(fileIds, workspaceId, true);

        Set<String> parentIdsInRecycle = collectParentIdsInRecycle(fileIds, workspaceId);
        allIdsToRestore.addAll(parentIdsInRecycle);

        if (CollUtil.isEmpty(allIdsToRestore)) {
            throw new BusinessException(ErrorMessages.RECYCLE_FILE_NOT_FOUND);
        }

        fileInfoMapper.restoreByIds(allIdsToRestore, workspaceId);

        log.info("工作空间 {} 恢复文件/文件夹，共 {} 项", workspaceId, allIdsToRestore.size());
    }

    /**
     * 向上递归收集：找出这些文件在回收站中的所有祖先文件夹
     */
    private Set<String> collectParentIdsInRecycle(List<String> currentIds, String workspaceId) {
        Set<String> allParentIds = new HashSet<>();
        List<String> runnerIds = new ArrayList<>(currentIds);

        while (CollUtil.isNotEmpty(runnerIds)) {
            List<String> pIds = fileInfoMapper.selectParentIds(runnerIds, workspaceId)
                    .stream().filter(StrUtil::isNotBlank).distinct().collect(Collectors.toList());

            if (CollUtil.isEmpty(pIds)) break;

            // 2. 看看这些 parentId 中，哪些还在回收站里 (is_deleted = true)
            List<String> deletedParents = fileInfoMapper.selectDeletedIds(pIds);

            if (CollUtil.isEmpty(deletedParents)) break;

            // 3. 收集并继续往上找
            allParentIds.addAll(deletedParents);
            runnerIds = deletedParents;
        }
        return allParentIds;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void permanentlyDeleteFiles(List<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) {
            return;
        }
        workspaceRagAccess.assertNotProtectedRoots(fileIds);
        String workspaceId = WorkspaceContext.getWorkspaceId();
        Set<String> allFileIds = collectFileIdsRecursively(fileIds, workspaceId, true);
        if (CollUtil.isEmpty(allFileIds)) {
            throw new BusinessException(ErrorMessages.RECYCLE_FILE_NOT_FOUND_DELETE);
        }
        List<FileInfo> allFiles = fileInfoService.listByIds(allFileIds);
        List<FileInfo> physicalObjects = allFiles.stream()
                .filter(file -> StrUtil.isNotBlank(file.getObjectKey()))
                .collect(Collectors.toMap(
                        file -> String.valueOf(file.getStoragePlatformSettingId()) + "|" + file.getObjectKey(),
                        file -> file,
                        (left, right) -> left,
                        LinkedHashMap::new
                ))
                .values().stream().toList();

        fileInfoService.removeByIds(allFileIds);

        try {
            String userId = UserContext.getUserId();
            fileUserFavoritesService.removeByFileIds(allFileIds, userId);
        } catch (Exception e) {
            fileUserFavoritesService.removeByFileIds(allFileIds);
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        for (FileInfo file : physicalObjects) {
                            try {
                                objectReferenceService.deletePhysicalFileIfUnreferencedWithLock(file);
                            } catch (Exception e) {
                                log.error("删除无引用物理文件失败: {}", file.getObjectKey(), e);
                            }
                        }
                    }
                }
        );
    }

    @Transactional(rollbackFor = Exception.class)
    @Override
    public void clearRecycles() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String configId = StorageContext.getConfigId();

        // 直接从数据库查出所有回收站的“顶层项”ID
        List<String> topLevelIds = fileInfoMapper.selectTopLevelRecycleIds(workspaceId, configId);

        if (CollUtil.isNotEmpty(topLevelIds)) {
            Set<String> roots = workspaceRagAccess.protectedRootIds();
            List<String> purgeIds = topLevelIds.stream()
                    .filter(id -> !roots.contains(id))
                    .toList();
            if (CollUtil.isNotEmpty(purgeIds)) {
                this.permanentlyDeleteFiles(purgeIds);
            }
        }
    }


    /**
     * 递归收集文件ID（通用方法）
     *
     * @param fileIds     初始文件ID列表
     * @param workspaceId 工作空间ID
     * @param deletedOnly 是否只收集回收站中的文件
     * @return 收集到的所有文件ID集合
     */
    private Set<String> collectFileIdsRecursively(
            List<String> fileIds,
            String workspaceId,
            boolean deletedOnly) {

        List<FileInfo> files = fileInfoMapper.selectByIdsAndWorkspaceDeleted(
                fileIds, workspaceId, deletedOnly ? true : null);

        if (CollUtil.isEmpty(files)) {
            return Collections.emptySet();
        }

        Set<String> allFileIds = new HashSet<>();
        files.forEach(file -> collectFileIdsRecursive(file, allFileIds, workspaceId, deletedOnly));

        return allFileIds;
    }

    private void collectFileIdsRecursive(
            FileInfo file,
            Set<String> allFileIds,
            String workspaceId,
            boolean deletedOnly) {

        allFileIds.add(file.getId());

        if (file.getIsDir()) {
            List<FileInfo> children = fileInfoMapper.selectChildren(
                    file.getId(), workspaceId, deletedOnly ? true : null);
            children.forEach(child -> collectFileIdsRecursive(child, allFileIds, workspaceId, deletedOnly));
        }
    }
}
