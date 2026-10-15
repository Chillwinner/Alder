/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.service;

import cn.hutool.core.io.FileUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.common.utils.JsonUtils;
import com.xddcodec.fs.conversation.domain.ImConversation;
import com.xddcodec.fs.conversation.domain.ImMessage;
import com.xddcodec.fs.conversation.domain.dto.ImMessageMediaPayload;
import com.xddcodec.fs.conversation.domain.vo.ImMessageMediaUploadVO;
import com.xddcodec.fs.conversation.mapper.ImConversationMapper;
import com.xddcodec.fs.conversation.mapper.ImMessageMapper;
import com.xddcodec.fs.conversation.support.ImConstants;
import com.xddcodec.fs.conversation.support.ImMessageContentHelper;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CreateShareCmd;
import com.xddcodec.fs.File.domain.dto.SaveShareToWorkspaceCmd;
import com.xddcodec.fs.File.domain.vo.FileDetailVO;
import com.xddcodec.fs.File.domain.vo.FileShareVO;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileShareService;
import com.xddcodec.fs.storage.plugin.StorageClients;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ImMediaService {

    private static final long DEFAULT_IMAGE_MAX_BYTES = 2L * 1024 * 1024 * 1024;
    private static final long DEFAULT_FILE_MAX_BYTES = 2L * 1024 * 1024 * 1024;
    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "com", "msi", "dll", "scr", "vbs", "ps1", "sh"
    );
    private final StorageClients storageClients;
    private final ImConversationMapper imConversationMapper;
    private final ImMessageMapper imMessageMapper;
    private final ImGroupService imGroupService;
    private final FileInfoService fileInfoService;
    private final FileShareService fileShareService;

    @Value("${spring.application.name:free-fs}")
    private String applicationName;

    @Value("${fs.chat-save-path:/Chat}")
    private String chatSavePath;

    @Value("${fs.avatar-save-path:/Chat/user}")
    private String avatarSavePath;

    @Value("${fs.chat-message-image-max-bytes:2147483648}")
    private long imageMaxBytes;

    @Value("${fs.chat-message-file-max-bytes:2147483648}")
    private long fileMaxBytes;

    public String uploadGroupAvatar(MultipartFile file) {
        return uploadAvatarFile(file);
    }

    public String uploadUserAvatar(MultipartFile file) {
        return uploadAvatarFile(file);
    }

    public ImMessageMediaUploadVO uploadMessageMedia(String conversationId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        String userId = UserContext.getUserId();
        assertConversationMember(userId, conversationId);

        String originalName = StringUtils.defaultIfBlank(file.getOriginalFilename(), "file");
        String extension = StringUtils.substringAfterLast(originalName, ".").toLowerCase(Locale.ROOT);
        if (StringUtils.isNotBlank(extension) && BLOCKED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("im.message.media.blocked");
        }

        boolean image = isImage(file);
        long maxBytes = image ? resolveLimit(imageMaxBytes, DEFAULT_IMAGE_MAX_BYTES)
                : resolveLimit(fileMaxBytes, DEFAULT_FILE_MAX_BYTES);
        if (file.getSize() > maxBytes) {
            throw new BusinessException("im.message.media.too.large");
        }

        try {
            LocalStorageOperationService storage = (LocalStorageOperationService) storageClients.getLocal();
            String suffix = StringUtils.defaultIfBlank(FileUtil.getSuffix(originalName), "bin");
            String fileName = userId + "_" + System.currentTimeMillis() + "." + suffix;
            String objectKey = applicationName + chatSavePath + "/message/" + userId + "/" + fileName;
            storage.uploadFile(file.getInputStream(), objectKey);

            ImMessageMediaUploadVO result = new ImMessageMediaUploadVO();
            result.setUrl(storage.getRelativeFilePath(objectKey));
            result.setName(originalName);
            result.setSize(file.getSize());
            result.setMime(file.getContentType());
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
    }

    public ImMessageMediaUploadVO shareWorkspaceFile(String conversationId, String fileId) {
        String userId = UserContext.getUserId();
        assertConversationMember(userId, conversationId);
        FileInfo file = fileInfoService.getAuthorizedFile(fileId);
        if (file == null) {
            throw new BusinessException(ErrorMessages.FILE_NOT_FOUND);
        }
        String originalName = StringUtils.defaultIfBlank(file.getDisplayName(), file.getOriginalName());
        originalName = StringUtils.defaultIfBlank(originalName, "file");
        boolean dir = Boolean.TRUE.equals(file.getIsDir());
        if (!dir) {
            String extension = StringUtils.defaultIfBlank(file.getSuffix(), "").toLowerCase(Locale.ROOT);
            if (extension.startsWith(".")) {
                extension = extension.substring(1);
            }
            if (StringUtils.isBlank(extension)) {
                extension = StringUtils.substringAfterLast(originalName, ".").toLowerCase(Locale.ROOT);
            }
            if (StringUtils.isNotBlank(extension) && BLOCKED_EXTENSIONS.contains(extension)) {
                throw new BusinessException("im.message.media.blocked");
            }
        }
        CreateShareCmd cmd = new CreateShareCmd();
        cmd.setFileIds(List.of(fileId));
        cmd.setShareName(originalName);
        cmd.setExpireType(4);
        cmd.setNeedShareCode(false);
        cmd.setScope("preview,download");
        FileShareVO share = fileShareService.createShare(cmd);

        ImMessageMediaUploadVO result = new ImMessageMediaUploadVO();
        result.setShareId(share.getId());
        result.setFileId(file.getId());
        result.setName(originalName);
        long size = file.getSize() == null ? 0L : file.getSize();
        if (dir && size == 0L) {
            String previousStorage = StorageContext.getConfigId();
            try {
                if (StringUtils.isNotBlank(file.getStoragePlatformSettingId())) {
                    StorageContext.setConfigId(file.getStoragePlatformSettingId());
                }
                FileDetailVO details = fileInfoService.getFileDetails(fileId);
                if (details.getSize() != null) {
                    size = details.getSize();
                }
            } finally {
                StorageContext.setConfigId(previousStorage);
            }
        }
        result.setSize(size);
        result.setMime(file.getMimeType());
        result.setDir(dir);
        if (!dir) {
            result.setUrl("/apis/share/" + share.getId() + "/content/" + file.getId());
        }
        return result;
    }

    public FileInfo saveMessageToWorkspace(String conversationId, Long messageId, String parentId) {
        String userId = UserContext.getUserId();
        assertConversationMember(userId, conversationId);
        ImMessage message = imMessageMapper.selectById(messageId);
        if (message == null || !conversationId.equals(message.getConversationId())) {
            throw new BusinessException("im.message.media.invalid");
        }
        if (message.getRecalledAt() != null) {
            throw new BusinessException("im.message.recall.already");
        }
        String msgType = ImMessageContentHelper.normalizeMsgType(message.getMsgType());
        if (!ImConstants.MSG_IMAGE.equals(msgType) && !ImConstants.MSG_FILE.equals(msgType)) {
            throw new BusinessException("im.message.type.invalid");
        }
        ImMessageMediaPayload payload = JsonUtils.parseObject(message.getContent(), ImMessageMediaPayload.class);
        if (payload == null || StringUtils.isBlank(payload.getName())) {
            throw new BusinessException("im.message.media.invalid");
        }
        String targetParentId = StringUtils.trimToNull(parentId);
        try {
            if (StringUtils.isNotBlank(payload.getShareId())) {
                return copyShareToWorkspace(payload, targetParentId);
            }
            return copyChatFileToWorkspace(payload, message.getSenderId(), targetParentId);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
    }

    private FileInfo copyShareToWorkspace(ImMessageMediaPayload payload, String parentId) {
        SaveShareToWorkspaceCmd cmd = new SaveShareToWorkspaceCmd();
        cmd.setShareId(payload.getShareId());
        cmd.setFileId(payload.getFileId());
        cmd.setParentId(parentId);
        return fileShareService.saveShareToWorkspace(cmd);
    }

    private FileInfo copyChatFileToWorkspace(ImMessageMediaPayload payload, String senderId, String parentId)
            throws Exception {
        String url = StringUtils.trimToEmpty(payload.getUrl());
        String allowedPrefix = ImMessageContentHelper.buildAllowedUrlPrefix(
                applicationName, chatSavePath, senderId);
        if (!url.startsWith(allowedPrefix)) {
            throw new BusinessException("im.message.media.invalid");
        }
        String objectKey = url.startsWith("/files/") ? url.substring("/files/".length()) : url;
        if (objectKey.startsWith("/")) {
            objectKey = objectKey.substring(1);
        }
        LocalStorageOperationService storage = (LocalStorageOperationService) storageClients.getLocal();
        try (InputStream input = storage.downloadFile(objectKey)) {
            return fileInfoService.importStream(
                    input,
                    payload.getName(),
                    payload.getMime(),
                    payload.getSize(),
                    parentId
            );
        }
    }

    private String uploadAvatarFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        String contentType = file.getContentType();
        String suffix = StringUtils.defaultIfBlank(FileUtil.getSuffix(file.getOriginalFilename()), "")
                .toLowerCase(Locale.ROOT);
        boolean imageType = contentType != null && contentType.startsWith("image/");
        boolean imageSuffix = suffix.matches("png|jpe?g|gif|webp|bmp|heic|heif|avif|svg");
        if (contentType != null && !imageType && !imageSuffix) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
        String userId = UserContext.getUserId();
        try {
            LocalStorageOperationService storage = (LocalStorageOperationService) storageClients.getLocal();
            String fileName = userId + "_" + System.currentTimeMillis() + "."
                    + StringUtils.defaultIfBlank(suffix, "png");
            String objectKey = applicationName + avatarSavePath + "/" + userId + "/" + fileName;
            storage.uploadFile(file.getInputStream(), objectKey);
            return storage.getRelativeFilePath(objectKey);
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.FILE_UPLOAD_FAILED);
        }
    }

    private void assertConversationMember(String userId, String conversationId) {
        ImConversation conversation = imConversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new BusinessException("im.conversation.not.exist");
        }
        if (ImConstants.CONV_SINGLE.equals(conversation.getConvType())) {
            if (!userId.equals(conversation.getUserAId()) && !userId.equals(conversation.getUserBId())) {
                throw new BusinessException("im.conversation.forbidden");
            }
            return;
        }
        imGroupService.assertMember(conversation.getGroupId(), userId);
    }

    private boolean isImage(MultipartFile file) {
        String contentType = file.getContentType();
        return contentType != null && contentType.startsWith("image/");
    }

    private long resolveLimit(long configured, long fallback) {
        return configured > 0 ? configured : fallback;
    }
}
