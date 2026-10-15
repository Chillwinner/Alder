/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileShare;
import com.xddcodec.fs.File.domain.dto.CreateFileShareAccessRecordCmd;
import com.xddcodec.fs.File.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.File.domain.dto.CreateShareCmd;
import com.xddcodec.fs.File.domain.dto.SaveShareToWorkspaceCmd;
import com.xddcodec.fs.File.domain.dto.VerifyShareCodeCmd;
import com.xddcodec.fs.File.domain.event.CreateFileShareAccessRecordEvent;
import com.xddcodec.fs.File.domain.qry.FileShareQry;
import com.xddcodec.fs.File.domain.vo.FileDownloadVO;
import com.xddcodec.fs.File.domain.vo.FileShareThinVO;
import com.xddcodec.fs.File.domain.vo.FileShareVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.File.domain.vo.FolderDownloadTaskVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.mapper.FileShareMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileShareItemService;
import com.xddcodec.fs.file.service.StorageMountService;
import com.xddcodec.fs.file.service.FileShareService;
import com.xddcodec.fs.file.service.FileTransferTaskService;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.common.utils.Ip2RegionUtils;
import com.xddcodec.fs.common.utils.IpUtils;
import org.apache.commons.lang3.StringUtils;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import io.github.linpeilie.Converter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.InputStreamResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 文件分享服务实现类
 *
 * @Author: xddcode
 * @Date: 2025/10/30 10:02
 */
@Service
@RequiredArgsConstructor
public class FileShareServiceImpl implements FileShareService {

    private final FileShareMapper fileShareMapper;

    private final FileInfoMapper fileInfoMapper;

    private final FileInfoService fileInfoService;

    private final StorageMountService storageMountService;

    private final FileShareItemService fileShareItemService;

    private final FileTransferTaskService fileTransferTaskService;

    private final Converter converter;

    private final ApplicationEventPublisher eventPublisher;

    @Autowired
    private StorageServiceFacade storageServiceFacade;

    private static final String CACHE_NAME = "share";

    private static final int SHARE_SAVE_MAX_FILES = 200;

    private static final int SHARE_SAVE_MAX_DEPTH = 16;

    @Override
    public PageResult<FileShareVO> getPages(FileShareQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        int page = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 10 : qry.getPageSize();
        String keyword = StringUtils.isNotEmpty(qry.getKeyword()) ? qry.getKeyword().trim() : null;
        Boolean isAsc = null;
        String orderBy = null;
        if (StringUtils.isNotEmpty(qry.getOrderBy()) && StringUtils.isNotEmpty(qry.getOrderDirection())) {
            orderBy = StrUtil.toUnderlineCase(qry.getOrderBy());
            isAsc = "ASC".equalsIgnoreCase(qry.getOrderDirection());
        }

        Pages.start(page, pageSize);
        List<FileShare> fileShares = fileShareMapper.selectPage(workspaceId, keyword, orderBy, isAsc);
        List<FileShareVO> fileShareVOS = converter.convert(fileShares, FileShareVO.class);

        return PageResult.success(fileShareVOS, new PageInfo<>(fileShares).getTotal());
    }

    @Override
//    @Cacheable(value = CACHE_NAME, key = "#shareId", unless = "#result == null", sync = true)
    public FileShareVO getDetail(String shareId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileShare share = fileShareMapper.selectByIdAndWorkspace(shareId, workspaceId);
        if (share == null) {
            throw new BusinessException(ErrorMessages.SHARE_NOT_EXIST);
        }
        return buildShareVO(share);
    }

    /**
     * 构建分享VO
     */
    private FileShareVO buildShareVO(FileShare share) {
        FileShareVO vo = converter.convert(share, FileShareVO.class);
        // 是否永久有效
        vo.setIsPermanent(share.getExpireTime() == null);
        // 查询有几个文件
        vo.setFileCount(fileShareItemService.countByShareId(share.getId()));
        // 判断是否到期
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileShareVO createShare(CreateShareCmd cmd) {
        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileShare share = new FileShare();
        share.setUserId(userId);
        share.setWorkspaceId(workspaceId);
        share.setViewCount(0);
        share.setDownloadCount(0);

        List<FileInfo> authorizedFiles = cmd.getFileIds().stream()
                .distinct()
                .map(fileInfoService::getAuthorizedFile)
                .toList();

        if (StrUtil.isNotBlank(cmd.getShareName())) {
            share.setShareName(cmd.getShareName());
        } else {
            FileInfo fileInfo = authorizedFiles.getFirst();
            // 默认取第一个文件名，如果是多个文件则显示第一个文件名+"等{数量}"文件
            if (cmd.getFileIds().size() > 1) {
                if (fileInfo != null) {
                    share.setShareName(fileInfo.getDisplayName() + "等" + cmd.getFileIds().size() + "个文件");
                }
            } else {
                if (fileInfo != null) {
                    share.setShareName(fileInfo.getDisplayName());
                }
            }
        }
        if (cmd.getExpireType() == 4) {
            share.setExpireTime(null);
        } else if (cmd.getExpireType() == 3) {
            share.setExpireTime(cmd.getExpireTime());
        } else {
            share.setExpireTime(calculateExpireTime(cmd.getExpireType()));
        }

        if (Boolean.TRUE.equals(cmd.getNeedShareCode())) {
            String customCode = StrUtil.trim(cmd.getShareCode());
            if (StrUtil.isNotBlank(customCode)) {
                if (customCode.length() < 4 || customCode.length() > 32) {
                    throw new BusinessException(ErrorMessages.SHARE_CODE_INVALID);
                }
                share.setShareCode(customCode);
            } else {
                share.setShareCode(RandomUtil.randomString(4));
            }
        }

        share.setScope(cmd.getScope());
        share.setMaxViewCount(cmd.getMaxViewCount());
        share.setMaxDownloadCount(cmd.getMaxDownloadCount());

        share.setId(UUID.randomUUID().toString().replace("-", ""));
        fileShareMapper.insert(share);

        fileShareItemService.saveShareItems(share.getId(), cmd.getFileIds());

        // 更新被分享文件的访问时间
        updateFileLastAccessTime(cmd.getFileIds());

        return buildShareVO(share);
    }

    @Override
    public void assertOwnedShareItem(String userId, String shareId, String fileId) {
        FileShare share = getValidShare(shareId);
        if (!userId.equals(share.getUserId())) {
            throw new BusinessException(ErrorMessages.SHARE_NOT_EXIST);
        }
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        getShareAccessibleFile(share, shareFileIds, fileId);
    }


    /**
     * 更新文件最后访问时间
     *
     * @param fileIds 文件ID列表
     */
    private void updateFileLastAccessTime(List<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        fileIds.forEach(fileId -> {
            if (storageMountService.isVirtual(fileId)) {
                return;
            }
            FileInfo fileInfo = new FileInfo();
            fileInfo.setId(fileId);
            fileInfo.setLastAccessTime(now);
            fileInfoService.updateById(fileInfo);
        });
    }

    /**
     * 计算过期时间
     */
    private static LocalDateTime calculateExpireTime(Integer expireType) {
        LocalDateTime now = LocalDateTime.now();
        return switch (expireType) {
            case 1 -> now.plusDays(7);
            case 2 -> now.plusDays(30);
            default -> now.plusDays(7);
        };
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelShares(List<String> ids) {
        if (CollUtil.isEmpty(ids)) {
            return;
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<String> authorizedIds = fileShareMapper.selectByIdsAndWorkspace(ids, workspaceId)
                .stream()
                .map(FileShare::getId)
                .toList();
        if (authorizedIds.isEmpty()) {
            return;
        }
        fileShareMapper.deleteByIds(authorizedIds);
        fileShareItemService.removeByShareIds(authorizedIds);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelAllShares() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        List<FileShare> shareIds = fileShareMapper.selectByWorkspaceId(workspaceId);
        List<String> shareIdList = shareIds.stream().map(FileShare::getId).toList();
        this.cancelShares(shareIdList);
    }

    @Override
    public boolean verifyShareCode(VerifyShareCodeCmd cmd) {
        // 故意延迟200ms，增加暴力破解成本
        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        FileShare share = fileShareMapper.selectById(cmd.getShareId());
        if (share == null) {
            throw new BusinessException(ErrorMessages.SHARE_NOT_EXIST);
        }

        if (!share.getShareCode().equals(cmd.getShareCode())) {
            throw new BusinessException(ErrorMessages.SHARE_CODE_INCORRECT);
        }
        return true;
    }

    @Override
    public FileShareThinVO getFileShareThinVO(String shareId) {
        FileShare fileShare = fileShareMapper.selectById(shareId);
        if (fileShare == null) {
            throw new BusinessException(ErrorMessages.SHARE_NOT_EXIST);
        }
        FileShareThinVO vo = converter.convert(fileShare, FileShareThinVO.class);
        vo.setHasCheckCode(StringUtils.isNotEmpty(fileShare.getShareCode()));
        // 查询有几个文件
        vo.setFileCount(fileShareItemService.countByShareId(shareId));
        // 判断是否到期
        LocalDateTime expireTime = fileShare.getExpireTime();
        if (expireTime == null) {
            // 永久有效
            vo.setIsExpire(false);
        } else {
            LocalDateTime now = LocalDateTime.now();
            vo.setIsExpire(now.isAfter(expireTime));
        }
        return vo;
    }

    @Override
    public List<FileVO> getShareFileItems(String shareId, String parentId) {
        List<FileVO> items = listShareChildren(shareId, parentId);
        recordShareAccessLog(shareId);
        return items;
    }

    @Override
    public boolean isShareFileAvailable(String shareId, String fileId) {
        try {
            requireShareAccessibleFile(shareId, fileId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }

    @Override
    public FileInfo requireShareAccessibleFile(String shareId, String fileId) {
        FileShare share = getValidShare(shareId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        return getShareAccessibleFile(share, shareFileIds, fileId);
    }

    @Override
    public InputStream openShareDownload(String shareId, String fileId) {
        FileDownloadVO download = downloadFiles(shareId, fileId);
        try {
            return download.getResource().getInputStream();
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_DOWNLOAD_FAILED_NOT_EXIST);
        }
    }

    @Override
    public List<FileVO> listShareChildren(String shareId, String parentId) {
        FileShare fileShare = getValidShare(shareId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        List<FileInfo> fileInfos;
        if (StringUtils.isNotEmpty(parentId)) {
            FileInfo parent = getShareAccessibleFile(fileShare, shareFileIds, parentId);
            if (!Boolean.TRUE.equals(parent.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_NOT_DIRECTORY);
            }
            if (storageMountService.isS3Container(parentId)) {
                String previousWorkspace = WorkspaceContext.getWorkspaceId();
                try {
                    WorkspaceContext.setWorkspaceId(fileShare.getWorkspaceId());
                    return storageMountService.listS3(parentId, null);
                } finally {
                    WorkspaceContext.setWorkspaceId(previousWorkspace);
                }
            }
            fileInfos = fileInfoMapper.selectChildrenOrderedByDirAndUpdate(
                    parentId, fileShare.getWorkspaceId());
        } else if (CollUtil.isEmpty(shareFileIds)) {
            fileInfos = List.of();
        } else {
            return listShareRoots(shareFileIds, fileShare.getWorkspaceId());
        }
        return converter.convert(fileInfos, FileVO.class);
    }

    private List<FileVO> listShareRoots(List<String> shareFileIds, String workspaceId) {
        List<FileInfo> stored = fileInfoMapper.selectByIdsAndWorkspaceDeleted(
                shareFileIds, workspaceId, null);
        Map<String, FileInfo> byId = new HashMap<>();
        for (FileInfo info : stored) {
            byId.putIfAbsent(info.getId(), info);
        }
        List<FileVO> items = new ArrayList<>();
        for (String id : shareFileIds) {
            if (!byId.containsKey(id) && storageMountService.isVirtual(id)) {
                String previousWorkspace = WorkspaceContext.getWorkspaceId();
                try {
                    WorkspaceContext.setWorkspaceId(workspaceId);
                    FileInfo live = storageMountService.materialize(id);
                    FileVO vo = converter.convert(live, FileVO.class);
                    vo.setId(id);
                    vo.setUnavailable(false);
                    items.add(vo);
                    continue;
                } catch (RuntimeException ignored) {
                    // 对象已经不在桶里时，按失效分享项展示。
                } finally {
                    WorkspaceContext.setWorkspaceId(previousWorkspace);
                }
            }
            FileInfo info = byId.get(id);
            boolean gone = info == null || Boolean.TRUE.equals(info.getIsDeleted());
            FileVO vo = info == null ? new FileVO() : converter.convert(info, FileVO.class);
            if (info == null) {
                vo.setId(id);
                vo.setDisplayName("");
                vo.setIsDir(false);
            }
            if (gone) {
                vo.setUnavailable(true);
            }
            items.add(vo);
        }
        return items;
    }

    @Override
    public FileDownloadVO downloadFiles(String shareId, String fileId) {
        FileShare fileShare = getValidShare(shareId);
        if (!shareAllows(fileShare, "download")) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        return openShareFile(fileShare, fileId);
    }

    @Override
    public FileDownloadVO previewFile(String shareId, String fileId) {
        FileShare fileShare = getValidShare(shareId);
        if (!shareAllows(fileShare, "preview")) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        return openShareFile(fileShare, fileId);
    }

    private FileDownloadVO openShareFile(FileShare fileShare, String fileId) {
        return WorkspaceContext.callIn(fileShare.getWorkspaceId(), () -> {
            List<String> shareFileIds = fileShareItemService.getShareFileIds(fileShare.getId());
            FileInfo fileInfo = getShareAccessibleFile(fileShare, shareFileIds, fileId);

            IStorageOperationService storageService =
                    storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());

            if (!storageService.isFileExist(fileInfo.getObjectKey())) {
                throw new BusinessException(ErrorMessages.FILE_DOWNLOAD_FAILED_NOT_EXIST);
            }

            InputStream inputStream = storageService.downloadFile(fileInfo.getObjectKey());
            InputStreamResource resource = new InputStreamResource(inputStream);

            FileDownloadVO downloadVO = new FileDownloadVO();
            downloadVO.setFileName(fileInfo.getDisplayName());
            downloadVO.setFileSize(fileInfo.getSize());
            downloadVO.setResource(resource);
            return downloadVO;
        });
    }

    @Override
    public String getFileAccessUrl(String shareId, String fileId, Integer expireSeconds, boolean download) {
        FileShare fileShare = getValidShare(shareId);
        return WorkspaceContext.callIn(fileShare.getWorkspaceId(), () -> {
            FileInfo fileInfo = resolveShareFile(shareId, fileId);
            if (!download && !shareAllows(fileShare, "preview")) {
                throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
            }
            IStorageOperationService storageService = storageServiceFacade
                    .getStorageService(fileInfo.getStoragePlatformSettingId());
            if (!storageService.isFileExist(fileInfo.getObjectKey())) {
                throw new BusinessException(ErrorMessages.FILE_NOT_EXIST);
            }
            String downloadName = download ? fileInfo.getDisplayName() : null;
            return storageService.getFileUrl(fileInfo.getObjectKey(), expireSeconds, downloadName);
        });
    }

    private FileInfo resolveShareFile(String shareId, String fileId) {
        FileShare fileShare = getValidShare(shareId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        FileInfo fileInfo = getShareAccessibleFile(fileShare, shareFileIds, fileId);
        if (Boolean.TRUE.equals(fileInfo.getIsDir())) {
            throw new BusinessException(ErrorMessages.FILE_CANNOT_DOWNLOAD_DIR);
        }
        return fileInfo;
    }

    private static boolean shareAllows(FileShare share, String permission) {
        if (share == null || StrUtil.isBlank(share.getScope())) {
            return true;
        }
        return share.getScope().contains(permission);
    }

    @Override
    public FolderDownloadTaskVO createFolderDownloadTask(String shareId, String folderId) {
        FileShare fileShare = getValidShare(shareId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        FileInfo folder = getShareAccessibleFile(fileShare, shareFileIds, folderId);
        if (!Boolean.TRUE.equals(folder.getIsDir())) {
            throw new BusinessException(ErrorMessages.FILE_NOT_DIRECTORY);
        }
        bindShareTransferContext(fileShare, folder.getStoragePlatformSettingId());
        return fileTransferTaskService.createFolderDownloadTask(folderId);
    }

    @Override
    public FolderDownloadTaskVO getFolderDownloadTask(String shareId, String taskId) {
        FileShare fileShare = getValidShare(shareId);
        bindShareTransferContext(fileShare, null);
        FolderDownloadTaskVO task = fileTransferTaskService.getFolderDownloadTask(taskId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        getShareAccessibleFile(fileShare, shareFileIds, task.getFolderId());
        return task;
    }

    @Override
    public void cancelFolderDownloadTask(String shareId, String taskId) {
        FileShare fileShare = getValidShare(shareId);
        bindShareTransferContext(fileShare, null);
        FolderDownloadTaskVO task = fileTransferTaskService.getFolderDownloadTask(taskId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        getShareAccessibleFile(fileShare, shareFileIds, task.getFolderId());
        fileTransferTaskService.cancelFolderDownloadTask(taskId);
    }

    @Override
    public FileDownloadVO downloadFolderTaskFile(String shareId, String taskId) {
        FileShare fileShare = getValidShare(shareId);
        bindShareTransferContext(fileShare, null);
        FolderDownloadTaskVO task = fileTransferTaskService.getFolderDownloadTask(taskId);
        List<String> shareFileIds = fileShareItemService.getShareFileIds(shareId);
        getShareAccessibleFile(fileShare, shareFileIds, task.getFolderId());
        return fileTransferTaskService.downloadFolderTaskFile(taskId);
    }

    private void bindShareTransferContext(FileShare share, String storagePlatformSettingId) {
        WorkspaceContext.setWorkspaceId(share.getWorkspaceId());
        UserContext.setUserId(share.getUserId());
        if (StrUtil.isNotBlank(storagePlatformSettingId)) {
            StorageContext.setConfigId(storagePlatformSettingId);
        }
    }

    private FileShare getValidShare(String shareId) {
        FileShare fileShare = fileShareMapper.selectById(shareId);
        if (fileShare == null) {
            throw new BusinessException(ErrorMessages.SHARE_NOT_EXIST_OR_DELETED);
        }
        validateShareNotExpired(fileShare);
        return fileShare;
    }

    private FileInfo getShareAccessibleFile(FileShare share, List<String> shareFileIds, String fileId) {
        String previousWorkspace = WorkspaceContext.getWorkspaceId();
        try {
            WorkspaceContext.setWorkspaceId(share.getWorkspaceId());
            return findShareAccessibleFile(share, shareFileIds, fileId);
        } finally {
            WorkspaceContext.setWorkspaceId(previousWorkspace);
        }
    }

    private FileInfo findShareAccessibleFile(FileShare share, List<String> shareFileIds, String fileId) {
        FileInfo target = storageMountService.isVirtual(fileId)
                ? storageMountService.materialize(fileId)
                : fileInfoMapper.selectAuthorizedById(fileId, share.getWorkspaceId());
        FileInfo current = target;
        Set<String> visited = new HashSet<>();

        while (current != null && visited.add(current.getId())) {
            if (shareFileIds.contains(current.getId())) {
                return target;
            }
            if (StringUtils.isEmpty(current.getParentId())) {
                break;
            }
            current = storageMountService.isVirtual(current.getParentId())
                    ? storageMountService.materialize(current.getParentId())
                    : fileInfoMapper.selectAuthorizedById(current.getParentId(), share.getWorkspaceId());
        }

        throw new BusinessException(ErrorMessages.SHARE_FILE_NOT_IN_SHARE);
    }

    private void validateShareNotExpired(FileShare share) {
        if (share.getExpireTime() != null && LocalDateTime.now().isAfter(share.getExpireTime())) {
            throw new BusinessException(ErrorMessages.SHARE_EXPIRED);
        }
    }

    /**
     * 记录分享访问日志
     *
     * @param shareId 分享ID
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileInfo saveShareToWorkspace(SaveShareToWorkspaceCmd cmd) {
        FileShare share = getValidShare(cmd.getShareId());
        if (!shareAllows(share, "download")) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        String parentId = StringUtils.trimToNull(cmd.getParentId());
        resolveTargetStoragePlatformId(parentId);
        AtomicInteger copied = new AtomicInteger();
        return saveShareNode(cmd.getShareId(), cmd.getFileId(), parentId, 0, copied);
    }

    private FileInfo saveShareNode(String shareId,
                                   String sourceFileId,
                                   String parentId,
                                   int depth,
                                   AtomicInteger copied) {
        if (depth > SHARE_SAVE_MAX_DEPTH || copied.get() >= SHARE_SAVE_MAX_FILES) {
            throw new BusinessException("share.save.too.large");
        }
        FileInfo source = requireShareAccessibleFile(shareId, sourceFileId);
        String targetStorageId = resolveTargetStoragePlatformId(parentId);
        if (Boolean.TRUE.equals(source.getIsDir())) {
            CreateDirectoryCmd dirCmd = new CreateDirectoryCmd();
            dirCmd.setFolderName(StringUtils.defaultIfBlank(source.getDisplayName(), source.getOriginalName()));
            dirCmd.setParentId(parentId);
            FileInfo dir = fileInfoService.createDirectory(dirCmd);
            copied.incrementAndGet();
            for (FileVO child : listShareChildren(shareId, source.getId())) {
                saveShareNode(shareId, child.getId(), dir.getId(), depth + 1, copied);
            }
            return dir;
        }
        copied.incrementAndGet();
        if (!storageMountService.isS3Container(parentId)
                && sameShareStorage(source.getStoragePlatformSettingId(), targetStorageId)
                && StringUtils.isNotBlank(source.getObjectKey())) {
            return fileInfoService.createFileReferenceFrom(source, parentId, targetStorageId);
        }
        String name = StringUtils.defaultIfBlank(source.getDisplayName(), source.getOriginalName());
        try (InputStream input = openShareDownload(shareId, source.getId())) {
            return fileInfoService.importStream(input, name, source.getMimeType(), source.getSize(), parentId);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
    }

    private String resolveTargetStoragePlatformId(String parentId) {
        if (StringUtils.isNotBlank(parentId)) {
            FileInfo parent = fileInfoService.getAuthorizedFile(parentId);
            if (!Boolean.TRUE.equals(parent.getIsDir())) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
            return parent.getStoragePlatformSettingId();
        }
        return StorageContext.getConfigId();
    }

    private static boolean sameShareStorage(String left, String right) {
        return Objects.equals(StrUtil.blankToDefault(left, ""), StrUtil.blankToDefault(right, ""));
    }

    private void recordShareAccessLog(String shareId) {
        String ip = IpUtils.getIpAddr();
        String address = Ip2RegionUtils.search(ip);
        String browser = IpUtils.getBrowser();
        String os = IpUtils.getOs();
        CreateFileShareAccessRecordCmd cmd = new CreateFileShareAccessRecordCmd();
        cmd.setShareId(shareId);
        cmd.setAccessIp(ip);
        cmd.setAccessAddress(address);
        cmd.setBrowser(browser);
        cmd.setOs(os);
        eventPublisher.publishEvent(new CreateFileShareAccessRecordEvent(this, cmd));
    }

    /**
     * 原子递增访问次数
     */
//    private void incrementViewCount(String shareId) {
//        String key = VIEW_COUNT_KEY + shareId;
//        Long count = redisTemplate.opsForValue().increment(key);
//
//        if (count == null) {
//            return;
//        }
//        // 第一次访问时设置过期时间（与分享有效期一致，或者永不过期）
//        if (count == 1) {
//            // 选项1: 永不过期
//            // redisTemplate.persist(key);
//
//            // 选项2: 与分享有效期同步（推荐）
//            setExpireTimeByShareExpiry(shareId, key);
//        }
//    }
}
