/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import cn.dev33.satoken.secure.SaSecureUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.Context.UserContext;
import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.file.cache.TransferTaskCacheManager;
import com.xddcodec.fs.File.domain.FileCollection;
import com.xddcodec.fs.File.domain.FileCollectionSubmission;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.FileTransferTask;
import com.xddcodec.fs.File.domain.dto.CreateFileCollectionCmd;
import com.xddcodec.fs.File.domain.dto.CreateFileCollectionSubmissionCmd;
import com.xddcodec.fs.File.domain.qry.FileCollectionQry;
import com.xddcodec.fs.File.domain.qry.FileCollectionSubmissionQry;
import com.xddcodec.fs.File.domain.vo.FileCollectionDeletionResult;
import com.xddcodec.fs.File.domain.vo.FileCollectionPublicVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionSubmissionSessionVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionSubmissionVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionUploadContext;
import com.xddcodec.fs.File.domain.vo.FileCollectionVO;
import com.xddcodec.fs.File.enums.FileCollectionStatus;
import com.xddcodec.fs.File.enums.FileCollectionSubmissionStatus;
import com.xddcodec.fs.file.mapper.FileCollectionMapper;
import com.xddcodec.fs.file.mapper.FileCollectionSubmissionMapper;
import com.xddcodec.fs.file.mapper.FileTransferTaskMapper;
import com.xddcodec.fs.File.domain.vo.FileCollectionAssigneeVO;
import com.xddcodec.fs.file.service.FileCollectionService;
import com.xddcodec.fs.system.service.SysUserService;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.common.utils.IpUtils;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.xddcodec.fs.system.auth.PasswordHashService;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.system.service.SysRoleService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import com.xddcodec.fs.push.RealtimeUserPushPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FileCollectionServiceImpl implements FileCollectionService {

    private static final long DEFAULT_MAX_FILE_SIZE = 1024L * 1024 * 1024;
    private static final int MAX_SUBMISSION_SESSIONS_PER_HOUR = 20;
    private static final int MAX_CODE_ATTEMPTS_PER_TEN_MINUTES = 10;
    private static final DateTimeFormatter SUBMISSION_FOLDER_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final String ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final FileCollectionMapper collectionMapper;
    private final FileInfoService fileInfoService;
    private final FileCollectionSubmissionMapper submissionMapper;
    private final FileTransferTaskMapper transferTaskMapper;
    private final TransferTaskCacheManager transferTaskCacheManager;
    private final PasswordHashService passwordHashService;
    private final StringRedisTemplate redis;
    private final SysWorkspaceMemberService workspaceMemberService;
    private final SysRoleService roleService;
    private final RealtimeUserPushPublisher realtimeUserPushPublisher;
    private final SysUserService userService;

    @Override
    public PageResult<FileCollectionVO> getPages(FileCollectionQry qry) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        int pageNumber = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 10 : Math.min(qry.getPageSize(), 100);
        String keyword = StrUtil.isNotBlank(qry.getKeyword()) ? qry.getKeyword().trim() : null;
        FileCollectionStatus status = null;
        if (StrUtil.isNotBlank(qry.getStatus())) {
            try {
                status = FileCollectionStatus.valueOf(qry.getStatus().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                throw new BusinessException(ErrorMessages.COLLECTION_STATUS_INVALID);
            }
        }
        Pages.start(pageNumber, pageSize);
        List<FileCollection> collections = collectionMapper.selectPage(
                workspaceId, keyword, status, resolveOrderBy(qry.getOrderBy()),
                "ASC".equalsIgnoreCase(qry.getOrderDirection()));
        List<FileCollectionVO> records = collections.stream()
                .map(this::buildVO)
                .toList();
        return PageResult.success(records, new PageInfo<>(collections).getTotal());
    }

    @Override
    public FileCollectionVO getDetail(String collectionId) {
        return buildVO(getOwnedCollection(collectionId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileCollectionVO createCollection(CreateFileCollectionCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        FileInfo targetFolder = fileInfoService.getAuthorizedFile(cmd.getTargetFolderId());
        if (!Boolean.TRUE.equals(targetFolder.getIsDir()) || Boolean.TRUE.equals(targetFolder.getIsDeleted())) {
            throw new BusinessException(ErrorMessages.COLLECTION_TARGET_FOLDER_INVALID);
        }

        FileCollection collection = new FileCollection();
        collection.setUserId(userId);
        collection.setWorkspaceId(workspaceId);
        collection.setTargetFolderId(targetFolder.getId());
        collection.setStoragePlatformSettingId(targetFolder.getStoragePlatformSettingId());
        collection.setCollectionName(cmd.getCollectionName().trim());
        collection.setDescription(StrUtil.trimToNull(cmd.getDescription()));
        collection.setExpireTime(calculateExpireTime(cmd.getExpireType(), cmd.getExpireTime()));
        collection.setMaxFileSize(cmd.getMaxFileSize() == null
                ? DEFAULT_MAX_FILE_SIZE : cmd.getMaxFileSize());
        collection.setAllowedExtensions(normalizeAllowedExtensions(cmd.getAllowedExtensions()));
        collection.setAssigneeUserIds(joinAssigneeIds(cmd.getAssigneeUserIds()));
        collection.setStatus(FileCollectionStatus.OPEN);
        collection.setSubmissionCount(0);
        collection.setFileCount(0);
        collection.setTotalSize(0L);

        String plainAccessCode = null;
        if (Boolean.TRUE.equals(cmd.getNeedAccessCode())) {
            plainAccessCode = StrUtil.isBlank(cmd.getAccessCode())
                    ? RandomUtil.randomString(ACCESS_CODE_ALPHABET, 6)
                    : cmd.getAccessCode().trim();
            if (plainAccessCode.length() < 4) {
                throw new BusinessException(ErrorMessages.COLLECTION_ACCESS_CODE_TOO_SHORT);
            }
            collection.setAccessCodeHash(passwordHashService.encode(plainAccessCode));
        }

        collection.setId(UUID.randomUUID().toString().replace("-", ""));
        collectionMapper.insert(collection);
        for (String assigneeId : splitAssigneeIds(collection.getAssigneeUserIds())) {
            if (!assigneeId.equals(userId)) {
                realtimeUserPushPublisher.publish(
                        assigneeId,
                        RealtimeUserPushPublisher.TYPE_FILE_COLLECTION_ASSIGNED);
            }
        }
        FileCollectionVO vo = buildVO(collection);
        vo.setAccessCode(plainAccessCode);
        return vo;
    }

    @Override
    public java.util.List<FileCollectionVO> listAssignedToMe() {
        return collectionMapper.selectAssigned(WorkspaceContext.getWorkspaceId(), UserContext.getUserId())
                .stream()
                .map(this::buildVO)
                .toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileCollectionVO updateStatus(String collectionId, FileCollectionStatus status) {
        FileCollection collection = getOwnedCollection(collectionId);
        if (FileCollectionStatus.OPEN.equals(status)) {
            if (!StpUtil.hasPermission("file:write")) {
                throw new BusinessException(ErrorMessages.COLLECTION_NO_UPLOAD_PERMISSION);
            }
            ensureCollectionOwnerCanCollect(collection);
        }
        collection.setStatus(status);
        collection.setUpdatedAt(LocalDateTime.now());
        collectionMapper.updateById(collection);
        return buildVO(collection);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileCollectionDeletionResult deleteCollection(String collectionId) {
        FileCollection collection = getOwnedCollection(collectionId);
        FileCollectionVO collectionVO = buildVO(collection);

        int submissionCount = (int) submissionMapper.countByCollectionId(collectionId);

        // 只清理已经结束的传输任务元数据。进行中的任务交给定时清理，避免删除时
        // 与分片上传/合并线程竞争；无论哪种状态，都不会触碰 FileInfo 或对象存储。
        List<FileTransferTask> terminalTasks = transferTaskMapper.selectTerminalByCollection(
                collectionId, collection.getWorkspaceId());
        if (!terminalTasks.isEmpty()) {
            transferTaskMapper.deleteTerminalByCollection(collectionId, collection.getWorkspaceId());
            transferTaskCacheManager.cleanTasks(terminalTasks.stream()
                    .map(FileTransferTask::getTaskId)
                    .filter(Objects::nonNull)
                    .toList());
        }

        submissionMapper.deleteByCollectionId(collectionId);
        collectionMapper.deleteById(collection.getId());

        return new FileCollectionDeletionResult(
                collectionVO,
                submissionCount,
                terminalTasks.size());
    }

    @Override
    public PageResult<FileCollectionSubmissionVO> getSubmissions(
            String collectionId, FileCollectionSubmissionQry qry) {
        getOwnedCollection(collectionId);
        int pageNumber = qry.getPage() == null ? 1 : qry.getPage();
        int pageSize = qry.getPageSize() == null ? 20 : Math.min(qry.getPageSize(), 100);
        String keyword = StrUtil.isNotBlank(qry.getKeyword()) ? qry.getKeyword().trim() : null;
        Pages.start(pageNumber, pageSize);
        List<FileCollectionSubmission> submissions = submissionMapper.selectPageByCollectionId(collectionId, keyword);
        return PageResult.success(submissions.stream()
                .map(this::buildSubmissionVO)
                .toList(), new PageInfo<>(submissions).getTotal());
    }

    @Override
    public FileCollectionPublicVO getPublicInfo(String collectionId) {
        FileCollection collection = getCollection(collectionId);
        ensureCollectionOwnerCanCollect(collection);
        FileCollectionPublicVO vo = new FileCollectionPublicVO();
        vo.setId(collection.getId());
        vo.setCollectionName(collection.getCollectionName());
        vo.setDescription(collection.getDescription());
        vo.setExpireTime(collection.getExpireTime());
        vo.setExpired(isExpired(collection));
        vo.setHasAccessCode(StrUtil.isNotBlank(collection.getAccessCodeHash()));
        vo.setMaxFileSize(collection.getMaxFileSize());
        vo.setAllowedExtensions(collection.getAllowedExtensions());
        vo.setStatus(collection.getStatus());
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FileCollectionSubmissionSessionVO startSubmission(
            String collectionId, CreateFileCollectionSubmissionCmd cmd) {
        FileCollection collection = getActiveCollection(collectionId);
        ensureCollectionOwnerCanCollect(collection);
        String ip = IpUtils.getIpAddr();
        checkSubmissionRateLimit(collectionId, ip);
        verifyAccessCode(collection, cmd.getAccessCode(), ip);

        FileInfo targetFolder = fileInfoService.getById(collection.getTargetFolderId());
        if (targetFolder == null
                || !Objects.equals(targetFolder.getWorkspaceId(), collection.getWorkspaceId())
                || !Boolean.TRUE.equals(targetFolder.getIsDir())
                || Boolean.TRUE.equals(targetFolder.getIsDeleted())) {
            throw new BusinessException(ErrorMessages.COLLECTION_TARGET_FOLDER_MISSING);
        }

        String submitterName = sanitizeSubmitterName(cmd.getSubmitterName());
        String desiredFolderName = submitterName + "-" + LocalDateTime.now().format(SUBMISSION_FOLDER_TIME);
        String folderName = fileInfoService.generateUniqueName(
                collection.getWorkspaceId(), collection.getTargetFolderId(), desiredFolderName,
                true, null, collection.getStoragePlatformSettingId());

        FileInfo submissionFolder = new FileInfo();
        submissionFolder.setId(RandomUtil.randomString(32));
        submissionFolder.setOriginalName(folderName);
        submissionFolder.setDisplayName(folderName);
        submissionFolder.setIsDir(true);
        submissionFolder.setParentId(collection.getTargetFolderId());
        submissionFolder.setWorkspaceId(collection.getWorkspaceId());
        submissionFolder.setUserId(collection.getUserId());
        submissionFolder.setStoragePlatformSettingId(collection.getStoragePlatformSettingId());
        LocalDateTime now = LocalDateTime.now();
        submissionFolder.setUploadTime(now);
        submissionFolder.setUpdateTime(now);
        submissionFolder.setIsDeleted(false);
        fileInfoService.save(submissionFolder);

        String uploadToken = RandomUtil.randomString(64);
        FileCollectionSubmission submission = new FileCollectionSubmission();
        submission.setCollectionId(collectionId);
        submission.setSubmitterName(submitterName);
        submission.setSubmitterUserId(StrUtil.trimToNull(UserContext.getUserId()));
        submission.setSubmitterIp(ip);
        submission.setUserAgent(trim(IpUtils.getUserAgent(), 512));
        submission.setFolderId(submissionFolder.getId());
        submission.setUploadTokenHash(SaSecureUtil.sha256(uploadToken));
        submission.setFileCount(0);
        submission.setTotalSize(0L);
        submission.setStatus(FileCollectionSubmissionStatus.UPLOADING);
        submission.setId(UUID.randomUUID().toString().replace("-", ""));
        submissionMapper.insert(submission);
        collectionMapper.incrementSubmissionCount(collectionId, now);

        return FileCollectionSubmissionSessionVO.builder()
                .submissionId(submission.getId())
                .uploadToken(uploadToken)
                .folderName(folderName)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void completeSubmission(String collectionId, String submissionId, String uploadToken) {
        FileCollectionUploadContext context = authorizeToken(
                collectionId, submissionId, uploadToken, false, true);
        FileCollectionSubmission submission = context.getSubmission();
        if (FileCollectionSubmissionStatus.COMPLETED.equals(submission.getStatus())) {
            return;
        }
        if (submission.getFileCount() == null || submission.getFileCount() <= 0) {
            throw new BusinessException(ErrorMessages.COLLECTION_SUBMIT_EMPTY);
        }
        submission.setStatus(FileCollectionSubmissionStatus.COMPLETED);
        submission.setCompletedAt(LocalDateTime.now());
        submission.setUpdatedAt(LocalDateTime.now());
        submissionMapper.updateById(submission);

        FileCollection collection = context.getCollection();
        if (collection != null && collection.getUserId() != null) {
            realtimeUserPushPublisher.publish(
                    collection.getUserId(),
                    RealtimeUserPushPublisher.TYPE_FILE_COLLECTION_SUBMISSION
            );
        }
    }

    @Override
    public FileCollectionUploadContext authorizeUpload(
            String collectionId, String submissionId, String uploadToken) {
        return authorizeToken(collectionId, submissionId, uploadToken, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void recordUploadedFile(String collectionId, String submissionId, long fileSize) {
        LocalDateTime now = LocalDateTime.now();
        int submissionRows = submissionMapper.incrementFileStats(submissionId, fileSize, now);
        int collectionRows = collectionMapper.incrementFileStats(collectionId, fileSize, now);
        if (submissionRows != 1 || collectionRows != 1) {
            throw new BusinessException(ErrorMessages.COLLECTION_STATS_UPDATE_FAILED);
        }
    }

    private FileCollectionUploadContext authorizeToken(
            String collectionId, String submissionId, String uploadToken,
            boolean requireActiveCollection) {
        return authorizeToken(collectionId, submissionId, uploadToken,
                requireActiveCollection, false);
    }

    private FileCollectionUploadContext authorizeToken(
            String collectionId, String submissionId, String uploadToken,
            boolean requireActiveCollection, boolean allowCompletedSubmission) {
        if (StrUtil.isBlank(uploadToken)) {
            throw new BusinessException(ErrorMessages.COLLECTION_UPLOAD_TOKEN_MISSING);
        }
        FileCollection collection = requireActiveCollection
                ? getActiveCollection(collectionId) : getCollection(collectionId);
        FileCollectionSubmission submission = submissionMapper.selectByIdAndCollectionId(
                submissionId, collectionId);
        if (submission == null) {
            throw new BusinessException(ErrorMessages.COLLECTION_SUBMISSION_NOT_EXIST);
        }
        String providedHash = SaSecureUtil.sha256(uploadToken);
        if (!constantTimeEquals(providedHash, submission.getUploadTokenHash())) {
            throw new BusinessException(ErrorMessages.COLLECTION_UPLOAD_TOKEN_INVALID);
        }
        if (!allowCompletedSubmission
                && FileCollectionSubmissionStatus.COMPLETED.equals(submission.getStatus())) {
            throw new BusinessException(ErrorMessages.COLLECTION_SUBMISSION_ALREADY_DONE);
        }
        return new FileCollectionUploadContext(collection, submission);
    }

    private FileCollection getOwnedCollection(String collectionId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        FileCollection collection = collectionMapper.selectByIdAndWorkspace(collectionId, workspaceId);
        if (collection == null) {
            throw new BusinessException(ErrorMessages.COLLECTION_NOT_EXIST);
        }
        return collection;
    }

    private FileCollection getCollection(String collectionId) {
        FileCollection collection = collectionMapper.selectById(collectionId);
        if (collection == null) {
            throw new BusinessException(ErrorMessages.COLLECTION_NOT_EXIST);
        }
        return collection;
    }

    private FileCollection getActiveCollection(String collectionId) {
        FileCollection collection = getCollection(collectionId);
        if (!FileCollectionStatus.OPEN.equals(collection.getStatus())) {
            throw new BusinessException(ErrorMessages.COLLECTION_CLOSED);
        }
        if (isExpired(collection)) {
            throw new BusinessException(ErrorMessages.COLLECTION_EXPIRED);
        }
        return collection;
    }

    private void ensureCollectionOwnerCanCollect(FileCollection collection) {
        SysWorkspaceMember owner = workspaceMemberService.findByWorkspaceAndUser(
                collection.getWorkspaceId(), collection.getUserId());
        if (owner == null) {
            throw new BusinessException(ErrorMessages.COLLECTION_OWNER_LEFT);
        }
        List<String> permissions = roleService.getPermissionCodesByRoleId(owner.getRoleId());
        if (permissions == null
                || !permissions.contains("file:share")
                || !permissions.contains("file:write")) {
            throw new BusinessException(ErrorMessages.COLLECTION_OWNER_NO_PERMISSION);
        }
    }

    private void verifyAccessCode(FileCollection collection, String accessCode, String ip) {
        if (StrUtil.isBlank(collection.getAccessCodeHash())) {
            return;
        }
        String key = "file-collection:code-attempt:" + collection.getId() + ":" + ip;
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1) {
            redis.expire(key, java.time.Duration.ofMinutes(10));
        }
        if (attempts != null && attempts > MAX_CODE_ATTEMPTS_PER_TEN_MINUTES) {
            throw new BusinessException(ErrorMessages.COLLECTION_ACCESS_CODE_TOO_MANY);
        }
        if (StrUtil.isBlank(accessCode)
                || !passwordHashService.matches(accessCode.trim(), collection.getAccessCodeHash())) {
            throw new BusinessException(ErrorMessages.COLLECTION_ACCESS_CODE_INCORRECT);
        }
        redis.delete(key);
    }

    private void checkSubmissionRateLimit(String collectionId, String ip) {
        String key = "file-collection:submission-rate:" + collectionId + ":" + ip;
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, java.time.Duration.ofHours(1));
        }
        if (count != null && count > MAX_SUBMISSION_SESSIONS_PER_HOUR) {
            throw new BusinessException(ErrorMessages.COLLECTION_SUBMIT_TOO_MANY);
        }
    }

    private FileCollectionVO buildVO(FileCollection collection) {
        FileCollectionVO vo = new FileCollectionVO();
        vo.setId(collection.getId());
        vo.setCollectionName(collection.getCollectionName());
        vo.setDescription(collection.getDescription());
        vo.setTargetFolderId(collection.getTargetFolderId());
        FileInfo targetFolder = fileInfoService.getById(collection.getTargetFolderId());
        vo.setTargetFolderName(targetFolder == null ? "目标文件夹已删除" : targetFolder.getDisplayName());
        vo.setExpireTime(collection.getExpireTime());
        vo.setPermanent(collection.getExpireTime() == null);
        vo.setExpired(isExpired(collection));
        vo.setHasAccessCode(StrUtil.isNotBlank(collection.getAccessCodeHash()));
        vo.setMaxFileSize(collection.getMaxFileSize());
        vo.setAllowedExtensions(collection.getAllowedExtensions());
        vo.setAssigneeUserIds(splitAssigneeIds(collection.getAssigneeUserIds()));
        vo.setAssignees(buildAssignees(collection));
        vo.setStatus(collection.getStatus());
        vo.setSubmissionCount(collection.getSubmissionCount());
        vo.setFileCount(collection.getFileCount());
        vo.setTotalSize(collection.getTotalSize());
        vo.setCreatedAt(collection.getCreatedAt());
        vo.setUpdatedAt(collection.getUpdatedAt());
        return vo;
    }

    private FileCollectionSubmissionVO buildSubmissionVO(FileCollectionSubmission submission) {
        FileCollectionSubmissionVO vo = new FileCollectionSubmissionVO();
        vo.setId(submission.getId());
        vo.setSubmitterName(submission.getSubmitterName());
        vo.setSubmitterIp(submission.getSubmitterIp());
        vo.setFolderId(submission.getFolderId());
        vo.setFileCount(submission.getFileCount());
        vo.setTotalSize(submission.getTotalSize());
        vo.setStatus(submission.getStatus());
        vo.setCreatedAt(submission.getCreatedAt());
        vo.setCompletedAt(submission.getCompletedAt());
        return vo;
    }

    private String resolveOrderBy(String orderBy) {
        return switch (StrUtil.blankToDefault(orderBy, "createdAt")) {
            case "collectionName" -> "collection_name";
            case "expireTime" -> "expire_time";
            case "submissionCount" -> "submission_count";
            case "fileCount" -> "file_count";
            case "totalSize" -> "total_size";
            default -> "created_at";
        };
    }

    private LocalDateTime calculateExpireTime(Integer expireType, LocalDateTime customExpireTime) {
        int type = expireType == null ? 1 : expireType;
        LocalDateTime now = LocalDateTime.now();
        return switch (type) {
            case 1 -> now.plusDays(7);
            case 2 -> now.plusDays(30);
            case 3 -> {
                if (customExpireTime == null || !customExpireTime.isAfter(now)) {
                    throw new BusinessException(ErrorMessages.COLLECTION_EXPIRE_TIME_INVALID);
                }
                yield customExpireTime;
            }
            case 4 -> null;
            default -> throw new BusinessException(ErrorMessages.COLLECTION_EXPIRE_TYPE_INVALID);
        };
    }

    private String normalizeAllowedExtensions(String raw) {
        if (StrUtil.isBlank(raw)) {
            return null;
        }
        List<String> extensions = Arrays.stream(raw.split("[,;\\s]+"))
                .map(String::trim)
                .filter(StrUtil::isNotBlank)
                .map(value -> value.startsWith(".") ? value.substring(1) : value)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
        if (extensions.size() > 50) {
            throw new BusinessException(ErrorMessages.COLLECTION_FILE_TYPES_TOO_MANY);
        }
        for (String extension : extensions) {
            if (!extension.matches("[a-z0-9]{1,20}")) {
                throw new BusinessException(ErrorMessages.COLLECTION_FILE_TYPE_INVALID);
            }
        }
        return extensions.isEmpty() ? null : extensions.stream().collect(Collectors.joining(","));
    }

    private String sanitizeSubmitterName(String value) {
        String sanitized = value == null ? "" : value
                .replaceAll("[\\p{Cntrl}/\\\\]", "_")
                .replaceAll("\\s+", " ")
                .trim();
        sanitized = sanitized.replaceAll("^[. ]+|[. ]+$", "");
        if (sanitized.isBlank()) {
            throw new BusinessException(ErrorMessages.COLLECTION_SUBMITTER_NAME_REQUIRED);
        }
        return sanitized.length() <= 64 ? sanitized : sanitized.substring(0, 64);
    }

    private boolean isExpired(FileCollection collection) {
        return collection.getExpireTime() != null
                && LocalDateTime.now().isAfter(collection.getExpireTime());
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.UTF_8),
                right.getBytes(StandardCharsets.UTF_8));
    }

    private String trim(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private java.util.List<FileCollectionAssigneeVO> buildAssignees(FileCollection collection) {
        java.util.List<String> ids = splitAssigneeIds(collection.getAssigneeUserIds());
        if (ids.isEmpty()) {
            return java.util.List.of();
        }
        java.util.Set<String> done = new java.util.HashSet<>();
        java.util.List<String> submitted = submissionMapper.listCompletedSubmitterIds(collection.getId());
        if (submitted != null) {
            done.addAll(submitted);
        }
        java.util.List<FileCollectionAssigneeVO> out = new java.util.ArrayList<>();
        for (String id : ids) {
            FileCollectionAssigneeVO item = new FileCollectionAssigneeVO();
            item.setUserId(id);
            com.xddcodec.fs.System.domain.SysUser user = userService.getById(id);
            item.setName(user == null
                    ? id
                    : StrUtil.blankToDefault(user.getNickname(), user.getUsername()));
            item.setSubmitted(done.contains(id));
            out.add(item);
        }
        return out;
    }

    private static String joinAssigneeIds(java.util.List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return null;
        }
        return ids.stream().filter(StrUtil::isNotBlank).distinct().collect(java.util.stream.Collectors.joining(","));
    }

    private static java.util.List<String> splitAssigneeIds(String raw) {
        if (StrUtil.isBlank(raw)) {
            return java.util.List.of();
        }
        java.util.List<String> ids = new java.util.ArrayList<>();
        for (String part : raw.split(",")) {
            if (StrUtil.isNotBlank(part)) {
                ids.add(part.trim());
            }
        }
        return ids;
    }
}
