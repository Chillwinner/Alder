/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CopyFileCmd;
import com.xddcodec.fs.File.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.File.domain.dto.MoveFileCmd;
import com.xddcodec.fs.File.domain.dto.RenameFileCmd;
import com.xddcodec.fs.File.domain.qry.FileQry;
import com.xddcodec.fs.File.domain.vo.FileDetailVO;
import com.xddcodec.fs.File.domain.vo.FileNameConflictVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileObjectReferenceService;
import com.xddcodec.fs.file.service.StorageMountService;
import com.xddcodec.fs.file.service.WorkspaceRagAccess;
import com.xddcodec.fs.file.service.LocalQuotaService;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.storage.plugin.FileTypeEnum;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.StorageOperationException;
import org.apache.commons.lang3.StringUtils;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 文件资源服务实现类
 *
 * @Author: xddcode
 * @Date: 2025/5/8 9:40
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileInfoServiceImpl implements FileInfoService {

    private final FileInfoMapper fileInfoMapper;
    private final Converter converter;
    private final StorageServiceFacade storageServiceFacade;
    private final FileObjectReferenceService objectReferenceService;
    private final StorageMountService storageMountService;
    private final WorkspaceRagAccess workspaceRagAccess;
    private final LocalQuotaService localQuotaService;

    @Value("${spring.application.name:free-fs}")
    private String applicationName;

    @Override
    public FileInfo getById(String id) {
        return fileInfoMapper.selectById(id);
    }

    @Override
    public void save(FileInfo fileInfo) {
        if (fileInfo != null && !Boolean.TRUE.equals(fileInfo.getIsDir())) {
            localQuotaService.ensureRoom(
                    fileInfo.getWorkspaceId(),
                    fileInfo.getStoragePlatformSettingId(),
                    fileInfo.getSize());
        }
        fileInfoMapper.insert(fileInfo);
    }

    @Override
    public void updateById(FileInfo fileInfo) {
        fileInfoMapper.updateById(fileInfo);
    }

    @Override
    public List<FileInfo> listByIds(Collection<String> ids) {
        if (CollUtil.isEmpty(ids)) {
            return List.of();
        }
        return fileInfoMapper.selectByIds(ids);
    }

    @Override
    public void removeByIds(Collection<String> ids) {
        if (CollUtil.isEmpty(ids)) {
            return;
        }
        fileInfoMapper.deleteByIds(ids);
    }

    @Override
    public List<FileInfo> listExpiredRecycle(LocalDateTime expireTime) {
        return fileInfoMapper.selectExpiredRecycle(expireTime);
    }

    @Override
    public FileInfo getAuthorizedFile(String fileId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StrUtil.isBlank(workspaceId) || StrUtil.isBlank(fileId)) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        if (storageMountService.isVirtual(fileId)) {
            return storageMountService.materialize(fileId);
        }
        FileInfo fileInfo = fileInfoMapper.selectAuthorizedById(fileId, workspaceId);
        if (fileInfo == null) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        return fileInfo;
    }

    @Override
    public InputStream downloadFile(String fileId) {
        FileInfo fileInfo = getAuthorizedFile(fileId);
        if (fileInfo.getIsDir()) {
            throw new StorageOperationException(ErrorMessages.FILE_CANNOT_DOWNLOAD_DIR);
        }
        if (fileInfo.getIsDeleted()) {
            throw new StorageOperationException(ErrorMessages.FILE_DELETED);
        }

        // 根据文件记录中的 storagePlatformSettingId 获取对应的存储服务
        try {
            IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());
            return storageService.downloadFile(fileInfo.getObjectKey());
        } catch (StorageOperationException e) {
            // 直接抛出原始异常，让上层统一处理
            log.error("从存储平台下载文件失败: fileId={}, objectKey={}", fileId, fileInfo.getObjectKey(), e);
            throw e;
        }
    }

    @Override
    public String getFileUrl(String fileId, Integer expireSeconds) {
        return getFileUrl(fileId, expireSeconds, false);
    }

    @Override
    public String getFileUrl(String fileId, Integer expireSeconds, boolean download) {
        FileInfo fileInfo = getAuthorizedFile(fileId);
        if (fileInfo.getIsDir()) {
            throw new StorageOperationException(ErrorMessages.FILE_DIR_NO_URL);
        }
        if (fileInfo.getIsDeleted()) {
            throw new StorageOperationException(ErrorMessages.FILE_DELETED);
        }
        IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());
        if (!storageService.isFileExist(fileInfo.getObjectKey())) {
            throw new StorageOperationException(ErrorMessages.FILE_NOT_EXIST);
        }
        String downloadName = download ? fileInfo.getDisplayName() : null;
        return storageService.getFileUrl(fileInfo.getObjectKey(), expireSeconds, downloadName);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveFilesToRecycleBin(List<String> fileIds) {
        if (fileIds != null) {
            fileIds.forEach(workspaceRagAccess::assertAdminWriteOnFile);
        }
        workspaceRagAccess.assertNotProtectedRoots(fileIds);
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }

        List<String> liveNodes = fileIds.stream().filter(storageMountService::isS3Node).toList();
        storageMountService.deleteNodes(liveNodes);
        fileIds = fileIds.stream().filter(id -> !storageMountService.isS3Node(id)).toList();
        if (fileIds.isEmpty()) {
            return;
        }

        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<FileInfo> fileInfoList = fileInfoMapper.selectByIdsAndWorkspace(fileIds, workspaceId);
        if (fileInfoList.isEmpty()) {
            return;
        }

        // 收集所有需要删除的文件（包括子文件）
        List<FileInfo> toDeleteList = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (FileInfo fileInfo : fileInfoList) {
            if (!fileInfo.getIsDeleted()) {
                toDeleteList.add(fileInfo);

                // 如果是文件夹，递归获取所有子文件和子文件夹
                if (fileInfo.getIsDir()) {
                    List<FileInfo> children = getAllChildrenRecursively(fileInfo.getId(), workspaceId, false);
                    toDeleteList.addAll(children);
                }
            }
        }

        if (toDeleteList.isEmpty()) {
            return;
        }
        workspaceRagAccess.assertNotProtectedRoots(
                toDeleteList.stream().map(FileInfo::getId).toList());

        // 批量标记为删除
        toDeleteList.forEach(fileInfo -> {
            fileInfo.setIsDeleted(true);
            fileInfo.setDeletedTime(now);
        });

        fileInfoMapper.markDeletedByIds(
                toDeleteList.stream().map(FileInfo::getId).toList(), now);
    }


    /**
     * 递归获取文件夹下的所有子文件和子文件夹
     *
     * @param parentId       父文件夹ID
     * @param includeDeleted 是否包含已删除的文件
     * @return 所有子文件列表
     */
    private List<FileInfo> getAllChildrenRecursively(String parentId, String workspaceId, boolean includeDeleted) {
        List<FileInfo> allChildren = new ArrayList<>();

        List<FileInfo> directChildren = fileInfoMapper.selectChildren(
                parentId, workspaceId, includeDeleted ? null : false);

        for (FileInfo child : directChildren) {
            allChildren.add(child);

            // 如果是文件夹，递归查询
            if (child.getIsDir()) {
                allChildren.addAll(getAllChildrenRecursively(child.getId(), workspaceId, includeDeleted));
            }
        }

        return allChildren;
    }


    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileInfo createDirectory(CreateDirectoryCmd cmd) {
        workspaceRagAccess.assertAdminWriteOnParent(cmd.getParentId());
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (storageMountService.isLocalMount(cmd.getParentId())) {
            cmd.setParentId(null);
            StorageContext.setConfigId(null);
        } else if (storageMountService.isS3Container(cmd.getParentId())) {
            return storageMountService.mkdir(cmd.getParentId(), cmd.getFolderName(), userId, workspaceId);
        }
        String folderId = IdUtil.fastSimpleUUID();
        String platformConfigId = null;
        if (StrUtil.isNotBlank(cmd.getParentId())) {
            FileInfo parent = getAuthorizedFile(cmd.getParentId());
            if (!Boolean.TRUE.equals(parent.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
        }
        String baseName = cmd.getFolderName().trim();
        String finalName = generateUniqueName(
                workspaceId,
                cmd.getParentId(),
                baseName,
                true,
                null,
                platformConfigId
        );
        FileInfo dirInfo = new FileInfo();
        dirInfo.setId(folderId);
        dirInfo.setOriginalName(finalName);
        dirInfo.setDisplayName(finalName);
        dirInfo.setIsDir(true);
        dirInfo.setParentId(cmd.getParentId());
        dirInfo.setWorkspaceId(workspaceId);
        dirInfo.setUserId(userId);
        dirInfo.setStoragePlatformSettingId(platformConfigId);
        LocalDateTime now = LocalDateTime.now();
        dirInfo.setUploadTime(now);
        dirInfo.setUpdateTime(now);
        dirInfo.setIsDeleted(false);
        fileInfoMapper.insert(dirInfo);
        return dirInfo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void renameFile(String fileId, RenameFileCmd cmd) {
        workspaceRagAccess.assertNotProtectedRoots(List.of(fileId));
        workspaceRagAccess.assertAdminWriteOnFile(fileId);
        if (storageMountService.isS3Node(fileId)) {
            storageMountService.rename(fileId, cmd.getDisplayName());
            return;
        }
        FileInfo fileInfo = getAuthorizedFile(fileId);
        if (fileInfo.getDisplayName().equals(cmd.getDisplayName())) {
            return;
        }
        String storagePlatformSettingId = fileInfo.getStoragePlatformSettingId();
        String newName = cmd.getDisplayName().trim();
        String finalName = generateUniqueName(
                fileInfo.getWorkspaceId(),
                fileInfo.getParentId(),
                newName,
                fileInfo.getIsDir(),
                fileId,
                storagePlatformSettingId
        );
        fileInfo.setDisplayName(finalName);
        LocalDateTime now = LocalDateTime.now();
        fileInfo.setUpdateTime(now);
        fileInfo.setLastAccessTime(now);
        fileInfoMapper.updateById(fileInfo);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveFile(MoveFileCmd cmd) {
        workspaceRagAccess.assertAdminWriteOnParent(cmd.getDirId());
        if (cmd.getFileIds() != null) {
            cmd.getFileIds().forEach(workspaceRagAccess::assertAdminWriteOnFile);
        }
        workspaceRagAccess.assertNotProtectedRoots(cmd.getFileIds());
        if (CollUtil.isEmpty(cmd.getFileIds())) {
            throw new BusinessException(ErrorMessages.FILE_ID_LIST_EMPTY);
        }

        String workspaceId = WorkspaceContext.getWorkspaceId();
        String requestedDirId = StringUtils.isBlank(cmd.getDirId()) ? null : cmd.getDirId();
        if (storageMountService.needsByteTransfer(cmd.getFileIds(), requestedDirId)) {
            storageMountService.move(cmd.getFileIds(), requestedDirId, workspaceId, UserContext.getUserId());
            return;
        }
        String targetDirId = storageMountService.catalogParent(requestedDirId);

        if (targetDirId != null) {
            FileInfo dirInfo = getAuthorizedFile(targetDirId);
            if (dirInfo == null || !dirInfo.getIsDir()) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
        }

        List<FileInfo> fileInfos = fileInfoMapper.selectByIdsAndWorkspaceDeleted(
                cmd.getFileIds(), workspaceId, false);

        for (FileInfo fileInfo : fileInfos) {
            if (Objects.equals(fileInfo.getParentId(), targetDirId)) {
                continue;
            }

            if (targetDirId != null && fileInfo.getIsDir()) {
                if (fileInfo.getId().equals(targetDirId) || isSubDirectory(fileInfo.getId(), targetDirId, workspaceId)) {
                    throw new BusinessException(ErrorMessages.FILE_CANNOT_MOVE_TO_SELF);
                }
            }

            String finalName = generateUniqueName(
                    fileInfo.getWorkspaceId(),
                    targetDirId,
                    fileInfo.getDisplayName(),
                    fileInfo.getIsDir(),
                    fileInfo.getId(),
                    fileInfo.getStoragePlatformSettingId()
            );

            fileInfoMapper.updateParentAndName(
                    fileInfo.getId(), targetDirId, finalName, LocalDateTime.now());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<FileInfo> copyFiles(CopyFileCmd cmd) {
        workspaceRagAccess.assertAdminWriteOnParent(cmd.getDirId());
        if (CollUtil.isEmpty(cmd.getFileIds())) {
            throw new BusinessException(ErrorMessages.FILE_ID_LIST_EMPTY);
        }

        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String requestedDirId = StringUtils.isBlank(cmd.getDirId()) ? null : cmd.getDirId();
        if (storageMountService.needsByteTransfer(cmd.getFileIds(), requestedDirId)
                || storageMountService.isVirtual(requestedDirId)) {
            storageMountService.copy(cmd.getFileIds(), requestedDirId, workspaceId, userId);
            return List.of();
        }
        String targetDirId = storageMountService.catalogParent(requestedDirId);
        String targetStorageId = null;

        if (targetDirId != null) {
            FileInfo targetDir = getAuthorizedFile(targetDirId);
            if (!Boolean.TRUE.equals(targetDir.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
            targetStorageId = targetDir.getStoragePlatformSettingId();
        }

        List<String> requestedIds = cmd.getFileIds().stream().distinct().toList();
        List<FileInfo> sourceFiles = fileInfoMapper.selectByIdsAndWorkspaceDeleted(
                requestedIds, workspaceId, false);
        Map<String, FileInfo> sourceMap = sourceFiles.stream()
                .collect(Collectors.toMap(FileInfo::getId, file -> file));

        if (sourceMap.size() != requestedIds.size()) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }

        List<FileInfo> copiedTopLevelFiles = new ArrayList<>();
        for (String sourceId : requestedIds) {
            FileInfo source = sourceMap.get(sourceId);
            if (!sameStorage(source.getStoragePlatformSettingId(), targetStorageId)) {
                throw new BusinessException(ErrorMessages.FILE_CANNOT_COPY_ACROSS_STORAGE);
            }
            if (targetDirId != null && Boolean.TRUE.equals(source.getIsDir())
                    && (source.getId().equals(targetDirId)
                    || isSubDirectory(source.getId(), targetDirId, workspaceId))) {
                throw new BusinessException(ErrorMessages.FILE_CANNOT_COPY_TO_SELF);
            }

            String topLevelName = generateUniqueName(
                    workspaceId,
                    targetDirId,
                    source.getDisplayName(),
                    source.getIsDir(),
                    null,
                    targetStorageId
            );
            LocalDateTime now = LocalDateTime.now();
            List<FileInfo> copies = new ArrayList<>();
            FileInfo topLevelCopy = cloneFileInfo(source, targetDirId, topLevelName, userId, now);
            copies.add(topLevelCopy);
            if (Boolean.TRUE.equals(source.getIsDir())) {
                cloneDirectoryChildren(source.getId(), topLevelCopy.getId(), workspaceId, userId, now, copies);
            }

            // 每个顶层项目单独批量落库，让下一项的重名检测能够看到前一项。
            fileInfoMapper.insertBatch(copies);
            copiedTopLevelFiles.add(topLevelCopy);
        }
        return copiedTopLevelFiles;
    }

    private void cloneDirectoryChildren(String sourceParentId,
                                        String targetParentId,
                                        String workspaceId,
                                        String userId,
                                        LocalDateTime now,
                                        List<FileInfo> copies) {
        List<FileInfo> children = fileInfoMapper.selectChildrenOrderedByDirAndUpload(
                sourceParentId, workspaceId);

        for (FileInfo child : children) {
            FileInfo childCopy = cloneFileInfo(
                    child,
                    targetParentId,
                    child.getDisplayName(),
                    userId,
                    now
            );
            copies.add(childCopy);
            if (Boolean.TRUE.equals(child.getIsDir())) {
                cloneDirectoryChildren(child.getId(), childCopy.getId(), workspaceId, userId, now, copies);
            }
        }
    }

    private FileInfo cloneFileInfo(FileInfo source,
                                   String parentId,
                                   String displayName,
                                   String userId,
                                   LocalDateTime now) {
        FileInfo copy = new FileInfo();
        copy.setId(IdUtil.fastSimpleUUID());
        copy.setObjectKey(source.getObjectKey());
        copy.setOriginalName(source.getOriginalName());
        copy.setDisplayName(displayName);
        copy.setSuffix(source.getSuffix());
        copy.setSize(source.getSize());
        copy.setMimeType(source.getMimeType());
        copy.setIsDir(source.getIsDir());
        copy.setParentId(parentId);
        copy.setWorkspaceId(source.getWorkspaceId());
        copy.setUserId(userId);
        copy.setContentMd5(source.getContentMd5());
        copy.setStoragePlatformSettingId(source.getStoragePlatformSettingId());
        copy.setUploadTime(now);
        copy.setUpdateTime(now);
        copy.setLastAccessTime(null);
        copy.setIsDeleted(false);
        copy.setDeletedTime(null);
        return copy;
    }

    private boolean sameStorage(String left, String right) {
        return Objects.equals(StrUtil.blankToDefault(left, ""), StrUtil.blankToDefault(right, ""));
    }

    // 检查target Id是否是source Id的子目录
    private boolean isSubDirectory(String sourceId, String targetId, String workspaceId) {
        FileInfo current = fileInfoMapper.selectByIdAndWorkspace(targetId, workspaceId);
        while (current != null && current.getParentId() != null) {
            if (current.getParentId().equals(sourceId)) {
                return true;
            }
            current = fileInfoMapper.selectByIdAndWorkspace(current.getParentId(), workspaceId);
        }
        return false;
    }

    /**
     * 生成唯一的文件名（处理重名冲突）
     * <p>
     * - 如果不存在重名：返回原名称
     * - 如果存在重名：自动添加 (1), (2), (3)... 后缀
     *
     * @param workspaceId   工作空间ID
     * @param parentId      父目录ID
     * @param desiredName   期望的文件名
     * @param isDir         是否是文件夹
     * @param excludeFileId 排除的文件ID（可选，用于重命名场景）
     * @return 唯一的文件名
     */
    @Override
    public String generateUniqueName(String workspaceId, String parentId,
                                     String desiredName, Boolean isDir,
                                     String excludeFileId, String storagePlatformSettingId) {

        String nameWithoutExt = desiredName;
        String extension = "";
        if (!isDir && desiredName.contains(".")) {
            int lastDotIndex = desiredName.lastIndexOf(".");
            nameWithoutExt = desiredName.substring(0, lastDotIndex);
            extension = desiredName.substring(lastDotIndex);
        }
        List<FileInfo> existingFiles = fileInfoMapper.selectSameLevelByDisplayName(
                workspaceId,
                parentId,
                nameWithoutExt,
                isDir,
                excludeFileId,
                storagePlatformSettingId
        );
        if (!Boolean.TRUE.equals(isDir)) {
            String desiredExt = FileUtil.extName(desiredName);
            existingFiles = existingFiles.stream()
                    .filter(file -> sameExtension(desiredExt, FileUtil.extName(file.getDisplayName())))
                    .collect(Collectors.toList());
        }
        if (existingFiles.isEmpty()) {
            return desiredName;
        }
        Set<Integer> usedSuffixes = extractUsedSuffixes(existingFiles, nameWithoutExt, isDir);
        int suffixNum = 0;
        String finalName;
        do {
            suffixNum++;
            finalName = buildNameWithSuffix(nameWithoutExt, suffixNum, extension, isDir);
        } while (usedSuffixes.contains(suffixNum));
        log.info("检测到重名，自动重命名：{} -> {}", desiredName, finalName);
        return finalName;
    }

    @Override
    public boolean existsSameNameFile(String workspaceId, String parentId, String fileName,
                                      String storagePlatformSettingId) {
        if (StrUtil.isBlank(fileName)) {
            return false;
        }
        return fileInfoMapper.selectSameLevelExactName(
                workspaceId, parentId, fileName, false, storagePlatformSettingId) != null;
    }

    @Override
    public List<FileNameConflictVO> listNameConflicts(String parentId, List<String> fileNames) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();
        List<FileNameConflictVO> result = new ArrayList<FileNameConflictVO>();
        if (fileNames == null) {
            return result;
        }
        for (String fileName : fileNames) {
            FileNameConflictVO item = new FileNameConflictVO();
            item.setFileName(fileName);
            boolean conflict = existsSameNameFile(
                    workspaceId, parentId, fileName, storagePlatformSettingId);
            item.setConflict(conflict);
            if (conflict) {
                item.setSuggestedName(generateUniqueName(
                        workspaceId, parentId, fileName, false, null, storagePlatformSettingId));
            } else {
                item.setSuggestedName(fileName);
            }
            result.add(item);
        }
        return result;
    }

    private static boolean sameExtension(String left, String right) {
        String a = left == null ? "" : left.toLowerCase(Locale.ROOT);
        String b = right == null ? "" : right.toLowerCase(Locale.ROOT);
        return a.equals(b);
    }

    /**
     * 提取已使用的后缀数字
     * 示例：
     * - photo.jpg       -> 0
     * - photo(1).jpg    -> 1
     * - photo(2).jpg    -> 2
     * - photo(abc).jpg  -> -1 (忽略)
     */
    private Set<Integer> extractUsedSuffixes(List<FileInfo> existingFiles,
                                             String nameWithoutExt,
                                             Boolean isDir) {
        return existingFiles.stream()
                .map(f -> {
                    String displayName = f.getDisplayName();

                    // 移除扩展名（如果是文件）
                    if (!isDir && displayName.contains(".")) {
                        int lastDotIndex = displayName.lastIndexOf(".");
                        displayName = displayName.substring(0, lastDotIndex);
                    }

                    // 检查是否完全匹配基础名称（表示原始文件，后缀为 0）
                    if (displayName.equals(nameWithoutExt)) {
                        return 0;
                    }

                    // 匹配 (n) 格式的后缀
                    String pattern = "^" + Pattern.quote(nameWithoutExt) + " ?\\((\\d+)\\)$";
                    Matcher matcher = Pattern.compile(pattern).matcher(displayName);

                    if (matcher.find()) {
                        return Integer.parseInt(matcher.group(1));
                    }

                    return -1; // 不匹配的名称（忽略）
                })
                .filter(n -> n >= 0)  // 只保留有效的后缀数字
                .collect(Collectors.toSet());
    }

    /**
     * 构建带后缀的文件名
     *
     * @param nameWithoutExt 不含扩展名的文件名
     * @param suffixNum      后缀数字
     * @param extension      扩展名（含点号）
     * @param isDir          是否是文件夹
     * @return 完整的文件名
     */
    private String buildNameWithSuffix(String nameWithoutExt, int suffixNum,
                                       String extension, Boolean isDir) {
        if (isDir) {
            // 文件夹：baseName(1)
            return nameWithoutExt + " (" + suffixNum + ")";
        } else {
            return nameWithoutExt + " (" + suffixNum + ")" + extension;
        }
    }

    @Override
    public List<FileVO> getDirectoryTreePath(String dirId) {
        if (storageMountService.isVirtual(dirId)) {
            return storageMountService.path(dirId);
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileInfo fileInfo = getAuthorizedFile(dirId);

        List<FileVO> pathList = new ArrayList<>();
        FileInfo current = fileInfo;

        // 递归向上查找，直到根节点（parent_id 为 null）
        while (current != null) {
            FileVO fileVO = converter.convert(current, FileVO.class);
            pathList.add(0, fileVO);

            // 查找父节点
            if (current.getParentId() != null) {
                current = fileInfoMapper.selectAuthorizedById(current.getParentId(), workspaceId);
            } else {
                break;
            }
        }

        if (!pathList.isEmpty() && !storageMountService.isVirtual(pathList.get(0).getId())) {
            pathList.addAll(0, storageMountService.path(StorageMountService.LOCAL));
        }
        return pathList;
    }

    @Override
    public PageResult<FileVO> getList(FileQry qry) {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();

        int pageNum = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 10 : qry.getPageSize();
        if (Boolean.TRUE.equals(qry.getIsRecents())) {
            pageSize = 20;
        }

        boolean isTypeFilter = StrUtil.isNotBlank(qry.getFileType());
        boolean isFavoriteView = Boolean.TRUE.equals(qry.getIsFavorite()) && qry.getParentId() == null;
        boolean isDirFilter = Boolean.TRUE.equals(qry.getIsDir()) && qry.getParentId() == null;
        boolean isWorkspaceSearch = StrUtil.isNotBlank(qry.getKeyword()) && qry.getParentId() == null;
        boolean applyParentFilter = !Boolean.TRUE.equals(qry.getIsRecents())
                && !isTypeFilter && !isFavoriteView && !isDirFilter && !isWorkspaceSearch;

        String orderByField = switch (String.valueOf(qry.getOrderBy())) {
            case "displayName" -> "display_name";
            case "suffix" -> "suffix";
            case "size" -> "size";
            default -> "update_time";
        };
        boolean isAsc = "ASC".equalsIgnoreCase(qry.getOrderDirection());
        String keyword = StrUtil.isNotBlank(qry.getKeyword()) ? qry.getKeyword().trim() : null;
        FileTypeFilter filter = resolveFileTypeFilter(qry);
        String parentId = qry.getParentId();

        if (applyParentFilter && StrUtil.isBlank(parentId)) {
            return pageInMemory(storageMountService.listMounts(workspaceId), pageNum, pageSize);
        }
        if (applyParentFilter && storageMountService.isLocalMount(parentId)) {
            parentId = null;
        } else if (storageMountService.isS3Container(parentId)) {
            return pageInMemory(storageMountService.listS3(parentId, keyword), pageNum, pageSize);
        }

        Pages.start(pageNum, pageSize);
        List<FileVO> records = fileInfoMapper.selectFileList(
                userId,
                workspaceId,
                null,
                parentId,
                keyword,
                qry.getIsFavorite(),
                qry.getIsRecents(),
                qry.getIsDir(),
                applyParentFilter,
                orderByField,
                isAsc,
                filter.suffixes(),
                filter.excludeSuffixes(),
                filter.mode()
        );

        if (CollUtil.isNotEmpty(records)) {
            records.parallelStream().forEach(vo ->
                    vo.setThumbnailUrl(fillThumbnailUrl(vo.getId(), vo.getSuffix()))
            );
        }

        long total = new PageInfo<>(records).getTotal();
        if (pageNum == 1 && isWorkspaceSearch) {
            List<FileVO> remote = storageMountService.searchAll(workspaceId, keyword);
            if (CollUtil.isNotEmpty(remote)) {
                records.addAll(remote);
                total += remote.size();
            }
        }

        workspaceRagAccess.markSystemProtected(records);
        return PageResult.success(records, total);
    }

    private PageResult<FileVO> pageInMemory(List<FileVO> all, int pageNum, int pageSize) {
        int from = Math.max(0, (pageNum - 1) * pageSize);
        if (from >= all.size()) {
            return PageResult.success(List.of(), (long) all.size());
        }
        int to = Math.min(all.size(), from + pageSize);
        return PageResult.success(all.subList(from, to), (long) all.size());
    }

    /**
     * 填充图片封面链接
     */
    private String fillThumbnailUrl(String fileId, String suffix) {
        // 如果非图片文件跳过
        if (!FileTypeEnum.isImageFile(suffix)) {
            return null;
        }
        // 统一走同源文件流，避免把 minio/rustfs 等 Docker 内部地址返回给浏览器。
        try {
            FileInfo fileInfo = getAuthorizedFile(fileId);
            IStorageOperationService storageService = storageServiceFacade
                    .getStorageService(fileInfo.getStoragePlatformSettingId());
            return storageService.getFileUrl(fileInfo.getObjectKey(), 3600, null);
        } catch (Exception e) {
            return "/apis/file/" + fileId + "/content";
        }
    }

    @Override
    public Long calculateUsedStorage() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();

        List<FileInfo> fileInfoList = fileInfoMapper.selectUsedFiles(workspaceId, storagePlatformSettingId);

        // 统计总大小
        return fileInfoList.stream()
                .map(FileInfo::getSize)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .sum();
    }

    @Override
    public FileDetailVO getFileDetails(String fileId) {
        if (storageMountService.isVirtual(fileId)) {
            return storageMountService.detail(fileId);
        }
        FileInfo fileInfo = getAuthorizedFile(fileId);
        FileDetailVO vo = converter.convert(fileInfo, FileDetailVO.class);
        if (vo.getIsDir()) {
            Map<String, Long> stats = new HashMap<>();
            stats.put("size", 0L);
            stats.getOrDefault("fileCount", 0L);
            stats.put("fileCount", 0L);
            stats.put("folderCount", 0L);
            recursiveAccumulate(fileId, stats);

            //如果为文件夹则需要统计该文件夹下所有文件
            vo.setSize(stats.get("size"));
            vo.setIncludeFiles(stats.get("fileCount").intValue());
            vo.setIncludeFolders(stats.get("folderCount").intValue());
        } else {
            vo.setIncludeFiles(0);
            vo.setIncludeFolders(0);
            vo.setThumbnailUrl(fillThumbnailUrl(fileInfo.getId(), vo.getSuffix()));
        }
        return vo;
    }

    /**
     * 递归统计文件夹信息
     */
    private void recursiveAccumulate(String parentId, Map<String, Long> stats) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();
        List<FileInfo> children = fileInfoMapper.selectDirectoryChildren(
                parentId, workspaceId, storagePlatformSettingId);

        if (CollUtil.isEmpty(children)) {
            return;
        }

        for (FileInfo child : children) {
            if (child.getIsDir()) {
                // 统计文件夹个数并向下递归
                stats.put("folderCount", stats.get("folderCount") + 1);
                recursiveAccumulate(child.getId(), stats);
            } else {
                // 统计文件个数及大小
                stats.put("fileCount", stats.get("fileCount") + 1);
                long fileSize = child.getSize() != null ? child.getSize() : 0L;
                stats.put("size", stats.get("size") + fileSize);
            }
        }
    }

    @Override
    public List<FileVO> getDirs(String parentId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (StrUtil.isBlank(parentId)) {
            return storageMountService.listMounts(workspaceId);
        }
        if (storageMountService.isLocalMount(parentId)) {
            List<FileVO> dirs = fileInfoMapper.selectDirs(workspaceId, null, null);
            workspaceRagAccess.markSystemProtected(dirs);
            return dirs;
        }
        if (storageMountService.isS3Container(parentId)) {
            return storageMountService.listS3(parentId, null).stream()
                    .filter(file -> Boolean.TRUE.equals(file.getIsDir()))
                    .toList();
        }
        List<FileVO> dirs = fileInfoMapper.selectDirs(workspaceId, null, parentId);
        workspaceRagAccess.markSystemProtected(dirs);
        return dirs;
    }

    @Override
    public List<FileVO> listChildren(String parentId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<FileInfo> children = fileInfoMapper.selectChildrenOrderedByDirAndUpload(parentId, workspaceId);
        List<FileVO> vos = converter.convert(children, FileVO.class);
        workspaceRagAccess.markSystemProtected(vos);
        return vos;
    }

    @Override
    public List<FileVO> getByFileIds(List<String> fileIds) {
        if (CollUtil.isEmpty(fileIds)) {
            return List.of();
        }
        List<FileInfo> fileInfos = fileInfoMapper.selectByIdsNotDeleted(fileIds);
        return converter.convert(fileInfos, FileVO.class);
    }

    private FileTypeFilter resolveFileTypeFilter(FileQry qry) {
        if (qry.getFileType() == null || qry.getFileType().trim().isEmpty()) {
            return FileTypeFilter.none();
        }
        FileTypeEnum.FileCategory category = FileTypeEnum.FileCategory.fromCode(qry.getFileType());
        if (category != null) {
            List<String> categorySuffixes = FileTypeEnum.getSuffixesByCategory(category);
            if (category == FileTypeEnum.FileCategory.OTHER) {
                return new FileTypeFilter(
                        categorySuffixes,
                        FileTypeEnum.getAllKnownSuffixesExcluding(FileTypeEnum.FileCategory.OTHER),
                        "other");
            }
            return categorySuffixes.isEmpty()
                    ? FileTypeFilter.none()
                    : new FileTypeFilter(categorySuffixes, null, "in");
        }
        FileTypeEnum fileType = FileTypeEnum.fromType(qry.getFileType());
        if (fileType == null) {
            log.warn("未识别的文件类型: {}", qry.getFileType());
            return FileTypeFilter.none();
        }
        if (fileType.isOther()) {
            return new FileTypeFilter(null, FileTypeEnum.getAllKnownSuffixes(), "unknown");
        }
        List<String> suffixes = fileType.getSuffixes();
        return (suffixes == null || suffixes.isEmpty())
                ? FileTypeFilter.none()
                : new FileTypeFilter(suffixes, null, "in");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileInfo createFileReferenceFrom(FileInfo source, String parentId, String targetStoragePlatformId) {
        if (source == null || Boolean.TRUE.equals(source.getIsDir())) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        if (!sameStorage(source.getStoragePlatformSettingId(), targetStoragePlatformId)) {
            throw new BusinessException(ErrorMessages.FILE_CANNOT_COPY_ACROSS_STORAGE);
        }
        if (StrUtil.isBlank(source.getObjectKey())) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String parent = StringUtils.isBlank(parentId) ? null : parentId;
        if (parent != null) {
            FileInfo parentDir = getAuthorizedFile(parent);
            if (!Boolean.TRUE.equals(parentDir.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
        }
        String displayName = generateUniqueName(
                workspaceId,
                parent,
                StringUtils.defaultIfBlank(source.getDisplayName(), source.getOriginalName()),
                false,
                null,
                targetStoragePlatformId);
        LocalDateTime now = LocalDateTime.now();
        FileInfo copy = new FileInfo();
        copy.setId(IdUtil.fastSimpleUUID());
        copy.setObjectKey(source.getObjectKey());
        copy.setOriginalName(source.getOriginalName());
        copy.setDisplayName(displayName);
        copy.setSuffix(source.getSuffix());
        copy.setSize(source.getSize());
        copy.setMimeType(source.getMimeType());
        copy.setIsDir(false);
        copy.setParentId(parent);
        copy.setWorkspaceId(workspaceId);
        copy.setUserId(userId);
        copy.setContentMd5(source.getContentMd5());
        copy.setStoragePlatformSettingId(targetStoragePlatformId);
        copy.setUploadTime(now);
        copy.setUpdateTime(now);
        copy.setIsDeleted(false);
        try (FileObjectReferenceService.ReferenceLock ignored = objectReferenceService.acquireObjectLock(
                targetStoragePlatformId, source.getObjectKey())) {
            fileInfoMapper.insert(copy);
        }
        return copy;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileInfo importStream(InputStream input, String fileName, String mimeType, Long size, String parentId) {
        if (input == null) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        workspaceRagAccess.assertAdminWriteOnParent(parentId);
        if (storageMountService.isS3Container(parentId)) {
            return importStreamToS3(input, fileName, mimeType, size, parentId);
        }
        if (storageMountService.isLocalMount(parentId)) {
            parentId = null;
        }
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String platformConfigId = null;
        if (StrUtil.isNotBlank(parentId)) {
            FileInfo parent = getAuthorizedFile(parentId);
            if (!Boolean.TRUE.equals(parent.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
            platformConfigId = parent.getStoragePlatformSettingId();
        }
        String safeName = StrUtil.blankToDefault(fileName, "file");
        String displayName = generateUniqueName(
                workspaceId, parentId, safeName, false, null, platformConfigId);
        String suffix = FileUtil.extName(displayName);
        String objectKey = applicationName + "/" + userId + "/"
                + DateUtil.format(new Date(), "yyyyMMdd") + "/"
                + IdUtil.fastSimpleUUID()
                + (StrUtil.isNotBlank(suffix) ? "." + suffix : "");
        IStorageOperationService storage = storageServiceFacade.getStorageService(platformConfigId);
        localQuotaService.ensureRoom(workspaceId, platformConfigId, size);
        storage.uploadFile(input, objectKey);
        LocalDateTime now = LocalDateTime.now();
        FileInfo fileInfo = new FileInfo();
        fileInfo.setId(IdUtil.fastSimpleUUID());
        fileInfo.setObjectKey(objectKey);
        fileInfo.setOriginalName(safeName);
        fileInfo.setDisplayName(displayName);
        fileInfo.setSuffix(suffix);
        fileInfo.setSize(size == null ? 0L : size);
        fileInfo.setMimeType(mimeType);
        fileInfo.setIsDir(false);
        fileInfo.setParentId(parentId);
        fileInfo.setWorkspaceId(workspaceId);
        fileInfo.setUserId(userId);
        fileInfo.setStoragePlatformSettingId(platformConfigId);
        fileInfo.setUploadTime(now);
        fileInfo.setUpdateTime(now);
        fileInfo.setIsDeleted(false);
        fileInfoMapper.insert(fileInfo);
        return fileInfo;
    }

    private FileInfo importStreamToS3(InputStream input, String fileName, String mimeType, Long size, String parentId) {
        String safeName = StrUtil.blankToDefault(fileName, "file");
        StorageMountService.LiveUpload live = storageMountService.resolveLiveUpload(parentId, safeName);
        long length = size == null || size < 0 ? -1L : size;
        try {
            if (length >= 0) {
                storageServiceFacade.getS3(live.storageSettingId()).uploadSized(input, live.objectKey(), length);
            } else {
                byte[] bytes = input.readAllBytes();
                length = bytes.length;
                storageServiceFacade.getS3(live.storageSettingId()).uploadSized(
                        new java.io.ByteArrayInputStream(bytes), live.objectKey(), length);
            }
        } catch (Exception e) {
            throw new StorageOperationException(ErrorMessages.FILE_UPLOAD_FAILED, e);
        }
        FileInfo fileInfo = storageMountService.materialize(
                storageMountService.liveNodeId(live.storageSettingId(), live.objectKey()));
        fileInfo.setDisplayName(live.displayName());
        fileInfo.setOriginalName(live.displayName());
        fileInfo.setSuffix(FileUtil.extName(live.displayName()));
        fileInfo.setSize(length);
        fileInfo.setMimeType(mimeType);
        return fileInfo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileInfo replaceFileContent(String fileId, byte[] bytes) {
        if (bytes == null) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        FileInfo fileInfo = getAuthorizedFile(fileId);
        if (Boolean.TRUE.equals(fileInfo.getIsDir())) {
            throw new BusinessException(ErrorMessages.FILE_CANNOT_DOWNLOAD_DIR);
        }
        IStorageOperationService storage = storageServiceFacade.getStorageService(
                fileInfo.getStoragePlatformSettingId());
        storage.uploadFile(new java.io.ByteArrayInputStream(bytes), fileInfo.getObjectKey());
        fileInfo.setSize((long) bytes.length);
        fileInfo.setUpdateTime(LocalDateTime.now());
        fileInfoMapper.updateById(fileInfo);
        return fileInfo;
    }

    private record FileTypeFilter(List<String> suffixes, List<String> excludeSuffixes, String mode) {
        private static FileTypeFilter none() {
            return new FileTypeFilter(null, null, null);
        }
    }
}
