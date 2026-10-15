/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.support;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.common.utils.JsonUtils;
import com.xddcodec.fs.conversation.domain.ImMessage;
import com.xddcodec.fs.conversation.domain.dto.ImMessageMediaPayload;
import com.xddcodec.fs.conversation.domain.vo.ImMessageVO;
import org.apache.commons.lang3.StringUtils;

import java.util.Locale;
import java.util.Set;

public final class ImMessageContentHelper {

    private static final int TEXT_MAX_LENGTH = 256;
    private static final int ENCRYPTED_MAX_LENGTH = 65536;
    private static final int MEDIA_JSON_MAX_LENGTH = 4096;
    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "com", "msi", "dll", "scr", "vbs", "ps1", "sh"
    );

    private ImMessageContentHelper() {
    }

    public static String normalizeMsgType(String msgType) {
        return StringUtils.defaultIfBlank(msgType, ImConstants.MSG_TEXT).trim().toUpperCase(Locale.ROOT);
    }

    public static PreparedMessage prepareText(String content) {
        String trimmed = content.trim();
        if (trimmed.length() > TEXT_MAX_LENGTH) {
            throw new BusinessException("im.message.too.long");
        }
        return new PreparedMessage(trimmed, ImConstants.MSG_TEXT, trimmed);
    }

    public static PreparedMessage prepareEncrypted(String content) {
        String trimmed = StringUtils.trimToEmpty(content);
        if (trimmed.isEmpty() || trimmed.length() > ENCRYPTED_MAX_LENGTH) {
            throw new BusinessException("im.message.too.long");
        }
        return new PreparedMessage(
                trimmed,
                ImConstants.MSG_ENCRYPTED_TEXT,
                ImConstants.INBOX_ENCRYPTED_PREVIEW
        );
    }

    public static PreparedMessage prepareMedia(String content,
                                               String msgType,
                                               String senderId,
                                               String applicationName,
                                               String chatSavePath) {
        if (!ImConstants.MSG_IMAGE.equals(msgType) && !ImConstants.MSG_FILE.equals(msgType)) {
            throw new BusinessException("im.message.type.invalid");
        }
        if (content.length() > MEDIA_JSON_MAX_LENGTH) {
            throw new BusinessException("im.message.too.long");
        }
        ImMessageMediaPayload payload = JsonUtils.parseObject(content, ImMessageMediaPayload.class);
        if (payload == null || StringUtils.isBlank(payload.getName())) {
            throw new BusinessException("im.message.media.invalid");
        }
        boolean shared = StringUtils.isNotBlank(payload.getShareId());
        if (shared) {
            if (StringUtils.isBlank(payload.getFileId())) {
                throw new BusinessException("im.message.media.invalid");
            }
        } else {
            if (StringUtils.isBlank(payload.getUrl())) {
                throw new BusinessException("im.message.media.invalid");
            }
            String expectedPrefix = buildAllowedUrlPrefix(applicationName, chatSavePath, senderId);
            String url = payload.getUrl().trim();
            if (!url.startsWith(expectedPrefix)) {
                throw new BusinessException("im.message.media.invalid");
            }
        }
        if (!Boolean.TRUE.equals(payload.getDir())) {
            String extension = StringUtils.substringAfterLast(payload.getName(), ".").toLowerCase(Locale.ROOT);
            if (StringUtils.isNotBlank(extension) && BLOCKED_EXTENSIONS.contains(extension)) {
                throw new BusinessException("im.message.media.blocked");
            }
        }
        if (ImConstants.MSG_IMAGE.equals(msgType)) {
            String mime = StringUtils.defaultString(payload.getMime()).toLowerCase(Locale.ROOT);
            if (StringUtils.isNotBlank(mime) && !mime.startsWith("image/")) {
                throw new BusinessException("im.message.media.invalid");
            }
        }
        String normalizedContent = JsonUtils.toJsonString(payload);
        String preview = ImConstants.MSG_IMAGE.equals(msgType)
                ? "[图片]"
                : "[文件] " + StringUtils.left(payload.getName(), 200);
        return new PreparedMessage(normalizedContent, msgType, preview);
    }

    public static String buildAllowedUrlPrefix(String applicationName,
                                               String chatSavePath,
                                               String senderId) {
        String path = chatSavePath.startsWith("/") ? chatSavePath : "/" + chatSavePath;
        return "/files/" + applicationName + path + "/message/" + senderId + "/";
    }

    public static String inboxPreview(ImMessageVO message) {
        if (message == null) {
            return "";
        }
        if (message.getRecalledAt() != null) {
            return ImConstants.RECALL_INBOX_PREVIEW;
        }
        return inboxPreview(message.getMsgType(), message.getContent());
    }

    public static String inboxPreview(ImMessage message) {
        if (message == null) {
            return "";
        }
        if (message.getRecalledAt() != null) {
            return ImConstants.RECALL_INBOX_PREVIEW;
        }
        return inboxPreview(message.getMsgType(), message.getContent());
    }

    private static String inboxPreview(String msgType, String content) {
        String type = normalizeMsgType(msgType);
        if (ImConstants.MSG_IMAGE.equals(type)) {
            return "[图片]";
        }
        if (ImConstants.MSG_FILE.equals(type)) {
            ImMessageMediaPayload payload = JsonUtils.parseObject(content, ImMessageMediaPayload.class);
            if (payload != null && StringUtils.isNotBlank(payload.getName())) {
                return "[文件] " + StringUtils.left(payload.getName(), 200);
            }
            return "[文件]";
        }
        if (ImConstants.MSG_ENCRYPTED_TEXT.equals(type)) {
            return ImConstants.INBOX_ENCRYPTED_PREVIEW;
        }
        return StringUtils.defaultString(content);
    }

    public record PreparedMessage(String content, String msgType, String inboxPreview) {
    }
}
