/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.Exception.StorageOperationException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.vo.FileDetailVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.Storage.domain.StorageSetting;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.mapper.StorageSettingMapper;
import com.xddcodec.fs.storage.plugin.FileTypeEnum;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import com.xddcodec.fs.storage.plugin.s3.S3StorageService;
import com.xddcodec.fs.storage.plugin.s3.S3StorageService.S3ListedObject;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * 把本地目录和每一个 S3 配置当成同一棵目录树里的挂载点。
 * S3 目录的内容来自实时列举，不依赖 file_info。跨挂载点的移动会在两个存储之间传字节。
 */
@Service
@RequiredArgsConstructor
public class StorageMountService {

    public static final String LOCAL = "mnt:local";
    private static final String MOUNT_PREFIX = "mnt:";
    private static final String NODE_PREFIX = "s3:";
    private static final String LOCAL_NAME = "本地";

    private final StorageSettingMapper storageSettingMapper;
    private final StorageServiceFacade storageServiceFacade;
    private final FileInfoMapper fileInfoMapper;
    private final FileObjectReferenceService objectReferenceService;
    private final LocalQuotaService localQuotaService;

    public boolean isVirtual(String id) {
        return id != null && (id.startsWith(MOUNT_PREFIX) || id.startsWith(NODE_PREFIX));
    }

    public boolean isLocalMount(String id) {
        return LOCAL.equals(id);
    }

    /** 工作空间根上的「本地 / 外接存储」挂载点，不能当普通文件夹删。 */
    public boolean isMountRoot(String id) {
        return id != null && id.startsWith(MOUNT_PREFIX);
    }

    public boolean isS3Node(String id) {
        return id != null && id.startsWith(NODE_PREFIX);
    }

    public boolean isS3Container(String id) {
        if (id == null) {
            return false;
        }
        if (id.startsWith(MOUNT_PREFIX) && !LOCAL.equals(id)) {
            return true;
        }
        return isS3Node(id) && objectKey(id).endsWith("/");
    }

    public boolean needsByteTransfer(List<String> fileIds, String targetDirId) {
        if (fileIds != null && fileIds.stream().anyMatch(this::isS3Node)) {
            return true;
        }
        if (isS3Container(targetDirId)) {
            return true;
        }
        String destStorage = catalogStorage(targetDirId);
        if (fileIds == null) {
            return false;
        }
        for (String fileId : fileIds) {
            if (isVirtual(fileId)) {
                return true;
            }
            FileInfo file = fileInfoMapper.selectById(fileId);
            if (file != null && !Objects.equals(blankToNull(file.getStoragePlatformSettingId()), destStorage)) {
                return true;
            }
        }
        return false;
    }

    public String catalogParent(String parentId) {
        return isLocalMount(parentId) ? null : parentId;
    }

    public List<FileVO> listMounts(String workspaceId) {
        List<FileVO> mounts = new ArrayList<>();
        mounts.add(directoryVo(LOCAL, LOCAL_NAME, null, LocalDateTime.now()));
        for (StorageSetting setting : storageSettingMapper.selectByWorkspaceId(workspaceId)) {
            mounts.add(directoryVo(mountId(setting.getId()), mountName(setting), null, LocalDateTime.now()));
        }
        return mounts;
    }

    public List<FileVO> listS3(String parentId, String keyword) {
        Location location = requireContainer(parentId);
        S3StorageService s3 = storageServiceFacade.getS3(location.settingId());
        String needle = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        List<FileVO> files = new ArrayList<>();
        for (S3ListedObject object : s3.listChildren(location.prefix())) {
            if (!needle.isEmpty() && !object.name().toLowerCase(Locale.ROOT).contains(needle)) {
                continue;
            }
            files.add(toVo(location.settingId(), object, parentId));
        }
        files.sort(Comparator
                .comparing((FileVO file) -> !Boolean.TRUE.equals(file.getIsDir()))
                .thenComparing(file -> file.getDisplayName() == null ? "" : file.getDisplayName(), String.CASE_INSENSITIVE_ORDER));
        return files;
    }

    public List<FileVO> searchAll(String workspaceId, String keyword) {
        if (StrUtil.isBlank(keyword)) {
            return List.of();
        }
        List<FileVO> found = new ArrayList<>();
        for (StorageSetting setting : storageSettingMapper.selectByWorkspaceId(workspaceId)) {
            try {
                S3StorageService s3 = storageServiceFacade.getS3(setting.getId());
                String needle = keyword.trim().toLowerCase(Locale.ROOT);
                for (S3ListedObject object : s3.listAll("")) {
                    if (object.directory()) {
                        continue;
                    }
                    String name = object.name();
                    int slash = name.lastIndexOf('/');
                    String display = slash >= 0 ? name.substring(slash + 1) : name;
                    if (!display.toLowerCase(Locale.ROOT).contains(needle)) {
                        continue;
                    }
                    String parentKey = slash >= 0 ? name.substring(0, slash + 1) : "";
                    String parentId = parentKey.isEmpty() ? mountId(setting.getId()) : nodeId(setting.getId(), parentKey);
                    found.add(toVo(setting.getId(), new S3ListedObject(display, object.key(), false, object.size(), object.modified()), parentId));
                }
            } catch (RuntimeException ignored) {
                // 某个桶暂时连不上时，搜索继续看其他挂载点。
            }
        }
        return found;
    }

    public List<FileVO> path(String dirId) {
        if (isLocalMount(dirId)) {
            return List.of(directoryVo(LOCAL, LOCAL_NAME, null, LocalDateTime.now()));
        }
        if (dirId != null && dirId.startsWith(MOUNT_PREFIX)) {
            StorageSetting setting = requireSetting(dirId.substring(MOUNT_PREFIX.length()));
            return List.of(directoryVo(mountId(setting.getId()), mountName(setting), null, LocalDateTime.now()));
        }
        ParsedNode node = parseNode(dirId);
        StorageSetting setting = requireSetting(node.settingId());
        List<FileVO> path = new ArrayList<>();
        path.add(directoryVo(mountId(setting.getId()), mountName(setting), null, LocalDateTime.now()));
        String key = node.key();
        if (key.endsWith("/")) {
            key = key.substring(0, key.length() - 1);
        }
        StringBuilder walked = new StringBuilder();
        for (String segment : key.split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            walked.append(segment).append('/');
            path.add(directoryVo(nodeId(setting.getId(), walked.toString()), segment, path.get(path.size() - 1).getId(), LocalDateTime.now()));
        }
        return path;
    }

    public FileInfo materialize(String fileId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (isLocalMount(fileId)) {
            return syntheticDir(LOCAL, LOCAL_NAME, null, null, workspaceId);
        }
        if (fileId.startsWith(MOUNT_PREFIX)) {
            StorageSetting setting = requireSetting(fileId.substring(MOUNT_PREFIX.length()));
            return syntheticDir(mountId(setting.getId()), mountName(setting), null, setting.getId(), workspaceId);
        }
        ParsedNode node = parseNode(fileId);
        requireSetting(node.settingId());
        boolean directory = node.key().endsWith("/");
        String name = displayName(node.key());
        FileInfo file = new FileInfo();
        file.setId(fileId);
        file.setObjectKey(directory ? node.key() : node.key());
        file.setOriginalName(name);
        file.setDisplayName(name);
        file.setSuffix(directory ? "" : FileUtil.extName(name));
        file.setIsDir(directory);
        file.setWorkspaceId(workspaceId);
        file.setStoragePlatformSettingId(node.settingId());
        file.setIsDeleted(false);
        if (!directory) {
            try {
                file.setSize(storageServiceFacade.getS3(node.settingId()).contentLength(node.key()));
            } catch (RuntimeException ignored) {
                file.setSize(0L);
            }
        }
        String parentKey = parentKey(node.key());
        file.setParentId(parentKey.isEmpty() ? mountId(node.settingId()) : nodeId(node.settingId(), parentKey));
        LocalDateTime now = LocalDateTime.now();
        file.setUploadTime(now);
        file.setUpdateTime(now);
        return file;
    }

    public FileDetailVO detail(String fileId) {
        FileInfo file = materialize(fileId);
        FileDetailVO vo = new FileDetailVO();
        vo.setId(file.getId());
        vo.setDisplayName(file.getDisplayName());
        vo.setSuffix(file.getSuffix());
        vo.setIsDir(file.getIsDir());
        vo.setUploadTime(file.getUploadTime());
        vo.setLastAccessTime(file.getUpdateTime());
        if (Boolean.TRUE.equals(file.getIsDir())) {
            int files = 0;
            int folders = 0;
            long size = 0;
            if (isS3Container(fileId) || isS3Node(fileId) || (fileId.startsWith(MOUNT_PREFIX) && !isLocalMount(fileId))) {
                String settingId = fileId.startsWith(MOUNT_PREFIX)
                        ? fileId.substring(MOUNT_PREFIX.length())
                        : parseNode(fileId).settingId();
                String prefix = fileId.startsWith(MOUNT_PREFIX) ? "" : objectKey(fileId);
                for (S3ListedObject object : storageServiceFacade.getS3(settingId).listAll(prefix)) {
                    if (object.directory()) {
                        folders++;
                    } else {
                        files++;
                        size += object.size();
                    }
                }
            }
            vo.setIncludeFiles(files);
            vo.setIncludeFolders(folders);
            vo.setSize(size);
        } else {
            vo.setSize(file.getSize());
            vo.setIncludeFiles(0);
            vo.setIncludeFolders(0);
            vo.setThumbnailUrl(thumbnail(fileId, file.getSuffix()));
        }
        return vo;
    }

    public FileInfo mkdir(String parentId, String folderName, String userId, String workspaceId) {
        Location location = requireContainer(parentId);
        String name = uniqueS3Name(location, sanitize(folderName), true, null);
        String key = location.prefix() + name + "/";
        storageServiceFacade.getS3(location.settingId()).putPlaceholder(key);
        return materialize(nodeId(location.settingId(), key));
    }

    public void rename(String fileId, String displayName) {
        ParsedNode node = parseNode(fileId);
        requireSetting(node.settingId());
        String name = sanitize(displayName);
        boolean directory = node.key().endsWith("/");
        String parent = parentKey(node.key());
        Location location = new Location(node.settingId(), parent);
        String unique = uniqueS3Name(location, name, directory, node.key());
        S3StorageService s3 = storageServiceFacade.getS3(node.settingId());
        if (!directory) {
            String dest = parent + unique;
            s3.copyObject(node.key(), dest);
            s3.deleteFile(node.key());
            return;
        }
        String destPrefix = parent + unique + "/";
        if (destPrefix.equals(node.key())) {
            return;
        }
        for (S3ListedObject object : s3.listAll(node.key())) {
            String relative = object.key().substring(node.key().length());
            s3.copyObject(object.key(), destPrefix + relative);
        }
        s3.putPlaceholder(destPrefix);
        s3.deletePrefix(node.key());
    }

    public void deleteNodes(List<String> fileIds) {
        for (String fileId : fileIds) {
            if (!isS3Node(fileId)) {
                continue;
            }
            ParsedNode node = parseNode(fileId);
            S3StorageService s3 = storageServiceFacade.getS3(node.settingId());
            if (node.key().endsWith("/")) {
                s3.deletePrefix(node.key());
            } else {
                s3.deleteFile(node.key());
            }
        }
    }

    public void move(List<String> fileIds, String targetDirId, String workspaceId, String userId) {
        transfer(fileIds, targetDirId, workspaceId, userId, true);
    }

    public void copy(List<String> fileIds, String targetDirId, String workspaceId, String userId) {
        transfer(fileIds, targetDirId, workspaceId, userId, false);
    }

    /**
     * 上传到 S3 挂载目录时，对象键用目录前缀加可见文件名，这样下次扫描能直接看见。
     * 不是 S3 目录时返回 null，调用方继续走原来的本地登记。
     */
    public LiveUpload resolveLiveUpload(String parentId, String fileName) {
        if (!isS3Container(parentId)) {
            return null;
        }
        Location location = requireContainer(parentId);
        String unique = uniqueS3Name(location, sanitize(fileName), false, null);
        return new LiveUpload(parentId, location.settingId(), location.prefix() + unique, unique);
    }

    public String liveNodeId(String settingId, String objectKey) {
        return nodeId(settingId, objectKey);
    }

    private void transfer(List<String> fileIds, String targetDirId, String workspaceId, String userId, boolean deleteSource) {
        Dest dest = resolveDest(targetDirId, workspaceId);
        for (String fileId : fileIds) {
            if (isS3Node(fileId)) {
                transferS3(parseNode(fileId), dest, workspaceId, userId, deleteSource);
            } else if (!isVirtual(fileId)) {
                FileInfo file = fileInfoMapper.selectAuthorizedById(fileId, workspaceId);
                if (file == null || Boolean.TRUE.equals(file.getIsDeleted())) {
                    throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
                }
                transferCatalog(file, dest, workspaceId, userId, deleteSource);
            }
        }
    }

    private void transferCatalog(FileInfo file, Dest dest, String workspaceId, String userId, boolean deleteSource) {
        if (dest.local() && Objects.equals(blankToNull(file.getStoragePlatformSettingId()), null) && deleteSource) {
            fileInfoMapper.updateParentAndName(file.getId(), dest.parentId(), file.getDisplayName(), LocalDateTime.now());
            return;
        }
        if (Boolean.TRUE.equals(file.getIsDir())) {
            Dest childDest = createDestDir(dest, file.getDisplayName(), workspaceId, userId);
            List<FileInfo> children = fileInfoMapper.selectChildren(file.getId(), workspaceId, false);
            for (FileInfo child : children) {
                transferCatalog(child, childDest, workspaceId, userId, deleteSource);
            }
            if (deleteSource) {
                fileInfoMapper.deleteByIds(List.of(file.getId()));
            }
            return;
        }
        String sourceStorage = blankToNull(file.getStoragePlatformSettingId());
        long size = file.getSize() == null ? 0L : file.getSize();
        if (dest.local()) {
            localQuotaService.ensureRoom(workspaceId, null, size);
            String objectKey = newLocalKey(userId, file.getDisplayName());
            try (InputStream input = storageServiceFacade.getStorageService(sourceStorage).downloadFile(file.getObjectKey())) {
                storageServiceFacade.getStorageService(null).uploadFile(input, objectKey);
            } catch (Exception e) {
                throw new StorageOperationException("跨存储移动失败: " + e.getMessage(), e);
            }
            insertLocalFile(file, dest.parentId(), objectKey, workspaceId, userId);
        } else {
            String key = dest.prefix() + uniqueS3Name(new Location(dest.settingId(), dest.prefix()), file.getDisplayName(), false, null);
            writeToS3(sourceStorage, file.getObjectKey(), size, dest.settingId(), key);
        }
        if (deleteSource) {
            fileInfoMapper.deleteByIds(List.of(file.getId()));
            objectReferenceService.deletePhysicalFileIfUnreferenced(file);
        }
    }

    private void transferS3(ParsedNode node, Dest dest, String workspaceId, String userId, boolean deleteSource) {
        requireSetting(node.settingId());
        S3StorageService source = storageServiceFacade.getS3(node.settingId());
        if (node.key().endsWith("/")) {
            String folderName = displayName(node.key());
            if (!dest.local() && node.settingId().equals(dest.settingId())) {
                if (dest.prefix().startsWith(node.key())) {
                    throw new BusinessException(ErrorMessages.FILE_CANNOT_MOVE_TO_SELF);
                }
                if ((dest.prefix() + folderName + "/").equals(node.key())) {
                    return;
                }
            }
            Dest childDest = createDestDir(dest, folderName, workspaceId, userId);
            for (S3ListedObject object : source.listAll(node.key())) {
                if (object.directory()) {
                    continue;
                }
                String relative = object.key().substring(node.key().length());
                if (childDest.local()) {
                    writeS3TreeToLocal(node.settingId(), object, relative, childDest.parentId(), workspaceId, userId);
                } else if (node.settingId().equals(childDest.settingId())) {
                    source.copyObject(object.key(), childDest.prefix() + relative);
                } else {
                    writeToS3(node.settingId(), object.key(), object.size(), childDest.settingId(), childDest.prefix() + relative);
                }
            }
            if (deleteSource) {
                source.deletePrefix(node.key());
            }
            return;
        }
        String name = displayName(node.key());
        if (dest.local()) {
            String objectKey = newLocalKey(userId, name);
            long size = source.contentLength(node.key());
            try (InputStream input = source.downloadFile(node.key())) {
                storageServiceFacade.getStorageService(null).uploadFile(input, objectKey);
            } catch (Exception e) {
                throw new StorageOperationException("跨存储移动失败: " + e.getMessage(), e);
            }
            FileInfo meta = new FileInfo();
            meta.setDisplayName(name);
            meta.setOriginalName(name);
            meta.setSuffix(FileUtil.extName(name));
            meta.setSize(size);
            meta.setMimeType(guessMime(name));
            insertLocalFile(meta, dest.parentId(), objectKey, workspaceId, userId);
        } else if (node.settingId().equals(dest.settingId())) {
            String key = dest.prefix() + uniqueS3Name(new Location(dest.settingId(), dest.prefix()), name, false, node.key());
            if (key.equals(node.key())) {
                return;
            }
            source.copyObject(node.key(), key);
        } else {
            String key = dest.prefix() + uniqueS3Name(new Location(dest.settingId(), dest.prefix()), name, false, null);
            writeToS3(node.settingId(), node.key(), source.contentLength(node.key()), dest.settingId(), key);
        }
        if (deleteSource) {
            source.deleteFile(node.key());
        }
    }

    private void writeS3TreeToLocal(String settingId, S3ListedObject object, String relative, String parentId,
                                    String workspaceId, String userId) {
        String[] parts = relative.split("/");
        String currentParent = parentId;
        for (int i = 0; i < parts.length - 1; i++) {
            currentParent = ensureLocalDir(currentParent, parts[i], workspaceId, userId);
        }
        String name = parts[parts.length - 1];
        String objectKey = newLocalKey(userId, name);
        try (InputStream input = storageServiceFacade.getS3(settingId).downloadFile(object.key())) {
            storageServiceFacade.getStorageService(null).uploadFile(input, objectKey);
        } catch (Exception e) {
            throw new StorageOperationException("跨存储移动失败: " + e.getMessage(), e);
        }
        FileInfo meta = new FileInfo();
        meta.setDisplayName(name);
        meta.setOriginalName(name);
        meta.setSuffix(FileUtil.extName(name));
        meta.setSize(object.size());
        meta.setMimeType(guessMime(name));
        insertLocalFile(meta, currentParent, objectKey, workspaceId, userId);
    }

    private Dest createDestDir(Dest dest, String name, String workspaceId, String userId) {
        if (dest.local()) {
            String id = ensureLocalDir(dest.parentId(), name, workspaceId, userId);
            return Dest.local(id);
        }
        String unique = uniqueS3Name(new Location(dest.settingId(), dest.prefix()), sanitize(name), true, null);
        String prefix = dest.prefix() + unique + "/";
        storageServiceFacade.getS3(dest.settingId()).putPlaceholder(prefix);
        return Dest.s3(dest.settingId(), prefix);
    }

    private String ensureLocalDir(String parentId, String name, String workspaceId, String userId) {
        if (parentId == null) {
            FileInfo existing = fileInfoMapper.selectSameLevelExactName(workspaceId, null, name, true, null);
            if (existing != null) {
                return existing.getId();
            }
        } else {
            List<FileInfo> children = fileInfoMapper.selectChildren(parentId, workspaceId, false);
            if (children != null) {
                for (FileInfo child : children) {
                    if (Boolean.TRUE.equals(child.getIsDir()) && name.equals(child.getDisplayName())) {
                        return child.getId();
                    }
                }
            }
        }
        FileInfo dir = new FileInfo();
        dir.setId(IdUtil.fastSimpleUUID());
        dir.setOriginalName(name);
        dir.setDisplayName(name);
        dir.setIsDir(true);
        dir.setParentId(parentId);
        dir.setWorkspaceId(workspaceId);
        dir.setUserId(userId);
        dir.setIsDeleted(false);
        LocalDateTime now = LocalDateTime.now();
        dir.setUploadTime(now);
        dir.setUpdateTime(now);
        fileInfoMapper.insert(dir);
        return dir.getId();
    }

    private void insertLocalFile(FileInfo meta, String parentId, String objectKey, String workspaceId, String userId) {
        FileInfo file = new FileInfo();
        file.setId(IdUtil.fastSimpleUUID());
        file.setObjectKey(objectKey);
        file.setOriginalName(meta.getOriginalName());
        file.setDisplayName(meta.getDisplayName());
        file.setSuffix(meta.getSuffix());
        file.setSize(meta.getSize());
        file.setMimeType(meta.getMimeType());
        file.setIsDir(false);
        file.setParentId(parentId);
        file.setWorkspaceId(workspaceId);
        file.setUserId(userId);
        file.setIsDeleted(false);
        LocalDateTime now = LocalDateTime.now();
        file.setUploadTime(now);
        file.setUpdateTime(now);
        fileInfoMapper.insert(file);
    }

    private void writeToS3(String sourceStorage, String sourceKey, long size, String destSetting, String destKey) {
        IStorageOperationService source = storageServiceFacade.getStorageService(sourceStorage);
        try (InputStream input = source.downloadFile(sourceKey)) {
            storageServiceFacade.getS3(destSetting).uploadSized(input, destKey, size);
        } catch (Exception e) {
            throw new StorageOperationException("跨存储移动失败: " + e.getMessage(), e);
        }
    }

    private Dest resolveDest(String targetDirId, String workspaceId) {
        if (StrUtil.isBlank(targetDirId) || isLocalMount(targetDirId)) {
            return Dest.local(null);
        }
        if (targetDirId.startsWith(MOUNT_PREFIX)) {
            StorageSetting setting = requireSetting(targetDirId.substring(MOUNT_PREFIX.length()));
            if (!workspaceId.equals(setting.getWorkspaceId())) {
                throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
            }
            return Dest.s3(setting.getId(), "");
        }
        if (isS3Node(targetDirId)) {
            ParsedNode node = parseNode(targetDirId);
            if (!node.key().endsWith("/")) {
                throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
            }
            requireSetting(node.settingId());
            return Dest.s3(node.settingId(), node.key());
        }
        FileInfo dir = fileInfoMapper.selectAuthorizedById(targetDirId, workspaceId);
        if (dir == null || !Boolean.TRUE.equals(dir.getIsDir())) {
            throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
        }
        if (StrUtil.isNotBlank(dir.getStoragePlatformSettingId())) {
            throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
        }
        return Dest.local(dir.getId());
    }

    private String catalogStorage(String targetDirId) {
        if (StrUtil.isBlank(targetDirId) || isLocalMount(targetDirId)) {
            return null;
        }
        if (isVirtual(targetDirId)) {
            return isS3Container(targetDirId) ? settingOf(targetDirId) : null;
        }
        FileInfo dir = fileInfoMapper.selectById(targetDirId);
        return dir == null ? null : blankToNull(dir.getStoragePlatformSettingId());
    }

    private String settingOf(String id) {
        if (id.startsWith(MOUNT_PREFIX)) {
            return id.substring(MOUNT_PREFIX.length());
        }
        return parseNode(id).settingId();
    }

    private Location requireContainer(String parentId) {
        if (parentId != null && parentId.startsWith(MOUNT_PREFIX) && !LOCAL.equals(parentId)) {
            StorageSetting setting = requireSetting(parentId.substring(MOUNT_PREFIX.length()));
            return new Location(setting.getId(), "");
        }
        if (isS3Node(parentId) && objectKey(parentId).endsWith("/")) {
            ParsedNode node = parseNode(parentId);
            requireSetting(node.settingId());
            return new Location(node.settingId(), node.key());
        }
        throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
    }

    private StorageSetting requireSetting(String settingId) {
        StorageSetting setting = storageSettingMapper.selectById(settingId);
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (setting == null || setting.getDeleted() != null && setting.getDeleted() == 1
                || StrUtil.isBlank(workspaceId) || !workspaceId.equals(setting.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.STORAGE_CONFIG_NOT_FOUND);
        }
        return setting;
    }

    private String uniqueS3Name(Location location, String name, boolean directory, String ignoreKey) {
        Set<String> used = new HashSet<>();
        for (S3ListedObject object : storageServiceFacade.getS3(location.settingId()).listChildren(location.prefix())) {
            if (ignoreKey != null && ignoreKey.equals(object.key())) {
                continue;
            }
            used.add(object.name().toLowerCase(Locale.ROOT));
        }
        if (!used.contains(name.toLowerCase(Locale.ROOT))) {
            return name;
        }
        String extension = directory ? "" : FileUtil.extName(name);
        String stem = extension.isEmpty() ? name : name.substring(0, name.length() - extension.length() - 1);
        for (int i = 1; i < 1000; i++) {
            String candidate = extension.isEmpty() ? stem + " (" + i + ")" : stem + " (" + i + ")." + extension;
            if (!used.contains(candidate.toLowerCase(Locale.ROOT))) {
                return candidate;
            }
        }
        return name + "-" + IdUtil.fastSimpleUUID();
    }

    private FileVO toVo(String settingId, S3ListedObject object, String parentId) {
        FileVO vo = new FileVO();
        vo.setId(nodeId(settingId, object.key()));
        vo.setObjectKey(object.key());
        vo.setOriginalName(object.name());
        vo.setDisplayName(object.name());
        vo.setIsDir(object.directory());
        vo.setParentId(parentId);
        vo.setSize(object.directory() ? 0L : object.size());
        vo.setSuffix(object.directory() ? "" : FileUtil.extName(object.name()));
        vo.setMimeType(object.directory() ? null : guessMime(object.name()));
        LocalDateTime time = object.modified() == null
                ? LocalDateTime.now()
                : LocalDateTime.ofInstant(object.modified(), ZoneId.systemDefault());
        vo.setUploadTime(time);
        vo.setUpdateTime(time);
        vo.setIsFavorite(false);
        if (!object.directory()) {
            vo.setThumbnailUrl(thumbnail(vo.getId(), vo.getSuffix()));
        }
        return vo;
    }

    private FileVO directoryVo(String id, String name, String parentId, LocalDateTime time) {
        FileVO vo = new FileVO();
        vo.setId(id);
        vo.setDisplayName(name);
        vo.setOriginalName(name);
        vo.setIsDir(true);
        vo.setParentId(parentId);
        vo.setSize(0L);
        vo.setSuffix("");
        vo.setUploadTime(time);
        vo.setUpdateTime(time);
        vo.setIsFavorite(false);
        if (isMountRoot(id)) {
            vo.setSystemProtected(true);
        }
        return vo;
    }

    private FileInfo syntheticDir(String id, String name, String parentId, String storageId, String workspaceId) {
        FileInfo file = new FileInfo();
        file.setId(id);
        file.setDisplayName(name);
        file.setOriginalName(name);
        file.setIsDir(true);
        file.setParentId(parentId);
        file.setWorkspaceId(workspaceId);
        file.setStoragePlatformSettingId(storageId);
        file.setIsDeleted(false);
        file.setUploadTime(LocalDateTime.now());
        file.setUpdateTime(LocalDateTime.now());
        return file;
    }

    private String thumbnail(String fileId, String suffix) {
        if (!FileTypeEnum.isImageFile(suffix)) {
            return null;
        }
        return "/apis/file/" + fileId + "/content";
    }

    private static String mountId(String settingId) {
        return MOUNT_PREFIX + settingId;
    }

    private static String nodeId(String settingId, String key) {
        return NODE_PREFIX + settingId + ":" + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(key.getBytes(StandardCharsets.UTF_8));
    }

    private String objectKey(String nodeId) {
        return parseNode(nodeId).key();
    }

    private ParsedNode parseNode(String id) {
        if (id == null || !id.startsWith(NODE_PREFIX)) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        int split = id.indexOf(':', NODE_PREFIX.length());
        if (split < 0) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        String settingId = id.substring(NODE_PREFIX.length(), split);
        String key = new String(Base64.getUrlDecoder().decode(id.substring(split + 1)), StandardCharsets.UTF_8);
        if (key.contains("..")) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        return new ParsedNode(settingId, key);
    }

    private static String parentKey(String key) {
        String trimmed = key.endsWith("/") ? key.substring(0, key.length() - 1) : key;
        int slash = trimmed.lastIndexOf('/');
        return slash < 0 ? "" : trimmed.substring(0, slash + 1);
    }

    private static String displayName(String key) {
        String trimmed = key.endsWith("/") ? key.substring(0, key.length() - 1) : key;
        int slash = trimmed.lastIndexOf('/');
        return slash < 0 ? trimmed : trimmed.substring(slash + 1);
    }

    private static String sanitize(String name) {
        String trimmed = name == null ? "" : name.trim().replace("\\", "/");
        int slash = trimmed.lastIndexOf('/');
        if (slash >= 0) {
            trimmed = trimmed.substring(slash + 1);
        }
        if (trimmed.isEmpty() || trimmed.contains("..")) {
            throw new BusinessException(ErrorMessages.FILE_TARGET_DIR_INVALID);
        }
        return trimmed;
    }

    private static String mountName(StorageSetting setting) {
        if (StrUtil.isNotBlank(setting.getRemark())) {
            return setting.getRemark();
        }
        return setting.getPlatformIdentifier();
    }

    private static String guessMime(String name) {
        String guessed = URLConnection.guessContentTypeFromName(name);
        return guessed == null ? "application/octet-stream" : guessed;
    }

    private static String newLocalKey(String userId, String name) {
        String suffix = FileUtil.extName(name);
        String ext = suffix.isEmpty() ? "" : "." + suffix;
        return "free-fs/" + userId + "/" + DateUtil.format(new java.util.Date(), "yyyyMMdd") + "/"
                + IdUtil.fastSimpleUUID() + ext;
    }

    private static String blankToNull(String value) {
        return StrUtil.isBlank(value) ? null : value;
    }

    public record LiveUpload(String parentId, String storageSettingId, String objectKey, String displayName) {
    }

    private record Location(String settingId, String prefix) {
    }

    private record ParsedNode(String settingId, String key) {
    }

    private record Dest(boolean local, String parentId, String settingId, String prefix) {
        static Dest local(String parentId) {
            return new Dest(true, parentId, null, null);
        }

        static Dest s3(String settingId, String prefix) {
            return new Dest(false, null, settingId, prefix);
        }
    }
}
