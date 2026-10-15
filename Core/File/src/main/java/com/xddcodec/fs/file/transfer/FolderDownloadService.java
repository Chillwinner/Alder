/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.transfer;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.StorageContext;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.Exception.StorageOperationException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.vo.FileDownloadVO;
import com.xddcodec.fs.File.domain.vo.FolderDownloadTaskVO;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.StorageMountService;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 文件夹打包下载。和上传任务分开：自己的临时文件、进度和清理，不经过传输任务表。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FolderDownloadService {

    private final FileInfoMapper fileInfoMapper;
    private final FileInfoService fileInfoService;
    private final StorageMountService storageMountService;
    private final StorageServiceFacade storageServiceFacade;
    private final TaskExecutor fileMergeExecutor;

    @Value("${fs.folder-download.temp-dir:${java.io.tmpdir}/free-fs-folder-download}")
    private String folderDownloadTempDir;
    private static final long FOLDER_DOWNLOAD_TASK_TTL_MS = 2 * 60 * 60 * 1000L;
    private static final long FOLDER_DOWNLOAD_CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000L;
    private static final long FOLDER_DOWNLOAD_CANCEL_WAIT_SECONDS = 5L;
    private static final String FOLDER_DOWNLOAD_TASK_PREFIX = "free-fs-folder-task-";
    private static final String FOLDER_DOWNLOAD_DIRECT_PREFIX = "free-fs-folder-";
    private final Map<String, FolderDownloadTask> folderDownloadTasks = new ConcurrentHashMap<>();
    private final Map<String, DeleteOnCloseInputStream> activeFolderDownloadStreams = new ConcurrentHashMap<>();
    private final Set<Path> activeFolderDownloadPaths = ConcurrentHashMap.newKeySet();

    public FolderDownloadTaskVO createFolderDownloadTask(String folderId) {
        cleanupExpiredFolderDownloadTasks();

        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String storagePlatformSettingId = StorageContext.getConfigId();

        FolderDownloadTask existingTask = findReusableFolderDownloadTask(userId, workspaceId, folderId);
        if (existingTask != null) {
            return toFolderDownloadTaskVO(existingTask);
        }

        FileInfo folderInfo = resolveDownloadFile(folderId);
        if (folderInfo == null || !Boolean.TRUE.equals(folderInfo.getIsDir()) || Boolean.TRUE.equals(folderInfo.getIsDeleted())) {
            throw new BusinessException(ErrorMessages.FOLDER_NOT_EXIST);
        }
        if (!workspaceId.equals(folderInfo.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }

        FolderDownloadTask task = new FolderDownloadTask();
        task.taskId = IdUtil.fastSimpleUUID();
        task.userId = userId;
        task.workspaceId = workspaceId;
        task.storagePlatformSettingId = storagePlatformSettingId;
        task.folderId = folderInfo.getId();
        task.folderName = folderInfo.getDisplayName();
        task.status = "queued";
        task.progress = 0;
        task.totalFiles = 0;
        task.processedFiles = 0;
        task.totalBytes = 0L;
        task.processedBytes = 0L;
        task.message = "正在创建下载任务";
        task.createdAt = System.currentTimeMillis();
        task.updatedAt = task.createdAt;
        task.lastActivityAt = task.createdAt;
        FutureTask<Void> buildFuture = new FutureTask<>(() -> {
            buildFolderDownloadTask(task, folderInfo);
            return null;
        });
        task.buildFuture = buildFuture;
        folderDownloadTasks.put(task.taskId, task);
        try {
            fileMergeExecutor.execute(buildFuture);
        } catch (RuntimeException e) {
            folderDownloadTasks.remove(task.taskId, task);
            throw e;
        }
        return toFolderDownloadTaskVO(task);
    }

    public FolderDownloadTaskVO getFolderDownloadTask(String taskId) {
        cleanupExpiredFolderDownloadTasks();
        return toFolderDownloadTaskVO(getAuthorizedFolderDownloadTask(taskId));
    }

    public void cancelFolderDownloadTask(String taskId) {
        FolderDownloadTask task = getAuthorizedFolderDownloadTask(taskId);
        cancelFolderDownloadTaskInternal(task, "用户取消文件夹打包", true);
    }

    public FileDownloadVO downloadFolderTaskFile(String taskId) {
        FolderDownloadTask task = getAuthorizedFolderDownloadTask(taskId);
        Path zipPath;
        long zipSize;
        synchronized (task) {
            if (!"completed".equals(task.status)) {
                throw new BusinessException(ErrorMessages.FOLDER_PACKAGING);
            }
            zipPath = task.zipPath;
            if (zipPath == null || !Files.exists(zipPath)) {
                folderDownloadTasks.remove(taskId, task);
                throw new BusinessException(ErrorMessages.FOLDER_DOWNLOAD_EXPIRED);
            }
            try {
                zipSize = Files.size(zipPath);
            } catch (IOException e) {
                throw new StorageOperationException(ErrorMessages.FOLDER_ZIP_READ_FAILED, e);
            }
            task.activeDownloadCount++;
            task.status = "downloading";
            task.downloadStartedAt = System.currentTimeMillis();
            task.lastActivityAt = task.downloadStartedAt;
        }

        String streamId = IdUtil.fastSimpleUUID();
        try {
            Path activeZipPath = normalizePath(zipPath);
            DeleteOnCloseInputStream managedInputStream = new DeleteOnCloseInputStream(
                    Files.newInputStream(zipPath),
                    zipPath,
                    false,
                    () -> {
                        activeFolderDownloadStreams.remove(streamId);
                        activeFolderDownloadPaths.remove(activeZipPath);
                        releaseFolderDownload(task);
                    }
            );
            activeFolderDownloadStreams.put(streamId, managedInputStream);
            InputStream inputStream = managedInputStream;
            FileDownloadVO downloadVO = new FileDownloadVO();
            downloadVO.setFileName(task.zipFileName);
            downloadVO.setFileSize(zipSize);
            downloadVO.setResource(new InputStreamResource(inputStream));
            return downloadVO;
        } catch (IOException e) {
            activeFolderDownloadStreams.remove(streamId);
            releaseFolderDownload(task);
            throw new StorageOperationException(ErrorMessages.FOLDER_DOWNLOAD_FAILED, e);
        }
    }

    private FolderDownloadTask findReusableFolderDownloadTask(String userId, String workspaceId, String folderId) {
        return folderDownloadTasks.values().stream()
                .filter(task -> userId.equals(task.userId)
                        && workspaceId.equals(task.workspaceId)
                        && folderId.equals(task.folderId)
                        && ("queued".equals(task.status)
                        || "scanning".equals(task.status)
                        || "packing".equals(task.status)
                        || "completed".equals(task.status))
                        && !task.cancelRequested)
                .findFirst()
                .orElse(null);
    }

    private FolderDownloadTask getAuthorizedFolderDownloadTask(String taskId) {
        FolderDownloadTask task = folderDownloadTasks.get(taskId);
        if (task == null) {
            throw new BusinessException(ErrorMessages.FOLDER_DOWNLOAD_TASK_NOT_EXIST);
        }

        String userId = UserContext.getUserId();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (!userId.equals(task.userId) || !workspaceId.equals(task.workspaceId)) {
            throw new BusinessException(ErrorMessages.FILE_NO_PERMISSION_DOWNLOAD);
        }
        return task;
    }

    private void buildFolderDownloadTask(FolderDownloadTask task, FileInfo folderInfo) {
        task.buildStarted = true;
        Path zipPath = null;
        try {
            checkFolderDownloadCancellation(task);
            updateFolderDownloadTask(task, "scanning", 0, "正在统计文件");
            FolderDownloadScanResult scanResult = scanDirectory(folderInfo, new HashSet<>(), task);
            synchronized (task) {
                task.totalFiles = scanResult.totalFiles;
                task.totalBytes = scanResult.totalBytes;
                touchFolderDownloadTask(task);
            }

            zipPath = createFolderDownloadZipPath(FOLDER_DOWNLOAD_TASK_PREFIX);
            synchronized (task) {
                task.zipPath = zipPath;
                task.zipFileName = buildZipFileName(task.folderName);
            }

            updateFolderDownloadTask(task, "packing", 0, "正在打包文件夹");
            try (ZipOutputStream zipOutputStream = new ZipOutputStream(Files.newOutputStream(zipPath))) {
                writeDirectoryToZipWithProgress(folderInfo, sanitizeZipName(folderInfo.getDisplayName()),
                        zipOutputStream, new HashSet<>(), task);
            }

            synchronized (task) {
                checkFolderDownloadCancellation(task);
                task.status = "completed";
                task.progress = 100;
                task.zipSize = Files.size(zipPath);
                task.message = "打包完成，准备下载";
                task.completedAt = System.currentTimeMillis();
                task.updatedAt = task.completedAt;
                task.lastActivityAt = task.completedAt;
            }
            log.info("文件夹打包完成: taskId={}, folderId={}, zipSize={}",
                    task.taskId, task.folderId, task.zipSize);
        } catch (FolderDownloadCanceledException e) {
            log.info("文件夹打包任务已取消: taskId={}, folderId={}", task.taskId, task.folderId);
            markFolderDownloadCanceled(task, e.getMessage());
        } catch (Exception e) {
            if (task.cancelRequested) {
                log.info("文件夹打包任务中断并取消: taskId={}, folderId={}", task.taskId, task.folderId);
                markFolderDownloadCanceled(task, "文件夹打包已取消");
            } else {
                log.error("文件夹打包任务失败: taskId={}, folderId={}", task.taskId, task.folderId, e);
                synchronized (task) {
                    task.status = "failed";
                    task.progress = 0;
                    task.errorMessage = e.getMessage();
                    task.message = "打包失败";
                    task.updatedAt = System.currentTimeMillis();
                    task.lastActivityAt = task.updatedAt;
                    task.completedAt = task.updatedAt;
                }
            }
        } finally {
            if (!"completed".equals(task.status)) {
                deleteFolderDownloadZip(task.zipPath != null ? task.zipPath : zipPath);
            }
            task.currentInputStream = null;
            task.buildFinished.countDown();
            if ("canceled".equals(task.status)) {
                folderDownloadTasks.remove(task.taskId, task);
            }
        }
    }

    private FolderDownloadScanResult scanDirectory(FileInfo dirInfo, Set<String> visitedDirIds,
                                                    FolderDownloadTask task) throws IOException {
        checkFolderDownloadCancellation(task);
        FolderDownloadScanResult result = new FolderDownloadScanResult();
        if (!visitedDirIds.add(dirInfo.getId())) {
            return result;
        }

        for (FileInfo child : listDirectoryChildren(dirInfo)) {
            checkFolderDownloadCancellation(task);
            touchFolderDownloadTask(task);
            if (Boolean.TRUE.equals(child.getIsDir())) {
                FolderDownloadScanResult childResult = scanDirectory(child, visitedDirIds, task);
                result.totalFiles += childResult.totalFiles;
                result.totalBytes += childResult.totalBytes;
            } else {
                result.totalFiles += 1;
                result.totalBytes += child.getSize() == null ? 0L : child.getSize();
            }
        }
        return result;
    }

    private void writeDirectoryToZipWithProgress(FileInfo dirInfo, String dirPath,
                                                 ZipOutputStream zipOutputStream, Set<String> visitedDirIds,
                                                 FolderDownloadTask task) throws IOException {
        checkFolderDownloadCancellation(task);
        if (!visitedDirIds.add(dirInfo.getId())) {
            return;
        }

        String normalizedDirPath = ensureTrailingSlash(dirPath);
        zipOutputStream.putNextEntry(new ZipEntry(normalizedDirPath));
        zipOutputStream.closeEntry();

        for (FileInfo child : listDirectoryChildren(dirInfo)) {
            checkFolderDownloadCancellation(task);
            String childPath = normalizedDirPath + sanitizeZipName(child.getDisplayName());
            if (Boolean.TRUE.equals(child.getIsDir())) {
                writeDirectoryToZipWithProgress(child, childPath, zipOutputStream, visitedDirIds, task);
            } else {
                writeFileToZipWithProgress(child, childPath, zipOutputStream, task);
            }
        }
    }

    private void writeFileToZipWithProgress(FileInfo fileInfo, String zipEntryName,
                                            ZipOutputStream zipOutputStream, FolderDownloadTask task) throws IOException {
        checkFolderDownloadCancellation(task);
        IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());
        if (!storageService.isFileExist(fileInfo.getObjectKey())) {
            log.warn("文件夹打包时跳过不存在的文件: fileId={}, objectKey={}", fileInfo.getId(), fileInfo.getObjectKey());
            incrementProcessedFile(task);
            return;
        }

        zipOutputStream.putNextEntry(new ZipEntry(zipEntryName));
        byte[] buffer = new byte[64 * 1024];
        InputStream sourceInputStream = storageService.downloadFile(fileInfo.getObjectKey());
        task.currentInputStream = sourceInputStream;
        try (InputStream inputStream = sourceInputStream) {
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                checkFolderDownloadCancellation(task);
                zipOutputStream.write(buffer, 0, read);
                addProcessedBytes(task, read);
            }
        } finally {
            task.currentInputStream = null;
            zipOutputStream.closeEntry();
            incrementProcessedFile(task);
        }
    }

    private void updateFolderDownloadTask(FolderDownloadTask task, String status, int progress, String message) {
        synchronized (task) {
            if (task.cancelRequested && !"canceled".equals(status)) {
                return;
            }
            task.status = status;
            task.progress = progress;
            task.message = message;
            touchFolderDownloadTask(task);
        }
    }

    private void addProcessedBytes(FolderDownloadTask task, long bytes) {
        synchronized (task) {
            task.processedBytes += bytes;
            updateFolderDownloadProgress(task);
        }
    }

    private void incrementProcessedFile(FolderDownloadTask task) {
        synchronized (task) {
            task.processedFiles += 1;
            updateFolderDownloadProgress(task);
        }
    }

    private void updateFolderDownloadProgress(FolderDownloadTask task) {
        if (task.cancelRequested) {
            return;
        }
        int progress = 0;
        if (task.totalBytes != null && task.totalBytes > 0) {
            progress = (int) Math.floor((task.processedBytes * 100.0) / task.totalBytes);
        } else if (task.totalFiles != null && task.totalFiles > 0) {
            progress = (int) Math.floor((task.processedFiles * 100.0) / task.totalFiles);
        }
        task.progress = Math.max(0, Math.min(99, progress));
        task.message = "正在打包文件夹";
        touchFolderDownloadTask(task);
    }

    private FolderDownloadTaskVO toFolderDownloadTaskVO(FolderDownloadTask task) {
        synchronized (task) {
            FolderDownloadTaskVO vo = new FolderDownloadTaskVO();
            vo.setTaskId(task.taskId);
            vo.setFolderId(task.folderId);
            vo.setFolderName(task.folderName);
            vo.setStatus(task.status);
            vo.setProgress(task.progress);
            vo.setTotalFiles(task.totalFiles);
            vo.setProcessedFiles(task.processedFiles);
            vo.setTotalBytes(task.totalBytes);
            vo.setProcessedBytes(task.processedBytes);
            vo.setZipSize(task.zipSize);
            vo.setMessage(task.message);
            vo.setErrorMessage(task.errorMessage);
            return vo;
        }
    }

    private void checkFolderDownloadCancellation(FolderDownloadTask task) throws FolderDownloadCanceledException {
        if (task.cancelRequested || Thread.currentThread().isInterrupted()) {
            throw new FolderDownloadCanceledException("文件夹打包已取消");
        }
    }

    private void touchFolderDownloadTask(FolderDownloadTask task) {
        synchronized (task) {
            if (task.cancelRequested) {
                return;
            }
            long now = System.currentTimeMillis();
            task.updatedAt = now;
            task.lastActivityAt = now;
        }
    }

    private void markFolderDownloadCanceled(FolderDownloadTask task, String message) {
        synchronized (task) {
            task.cancelRequested = true;
            task.status = "canceled";
            task.message = StringUtils.isEmpty(message) ? "文件夹打包已取消" : message;
            task.errorMessage = null;
            task.updatedAt = System.currentTimeMillis();
            task.lastActivityAt = task.updatedAt;
            task.completedAt = task.updatedAt;
        }
    }

    private boolean cancelFolderDownloadTaskInternal(FolderDownloadTask task, String message,
                                                      boolean rejectAlreadyStartedDownload) {
        Future<?> buildFuture;
        InputStream currentInputStream;
        boolean needsCancellation;
        boolean shouldInterrupt;
        synchronized (task) {
            if ("completed".equals(task.status) || "downloading".equals(task.status)) {
                if (rejectAlreadyStartedDownload) {
                    throw new BusinessException(ErrorMessages.FOLDER_DOWNLOAD_ALREADY_STARTED);
                }
                return false;
            }
            needsCancellation = !"failed".equals(task.status) && !"canceled".equals(task.status);
            shouldInterrupt = !"failed".equals(task.status);
            if (needsCancellation) {
                markFolderDownloadCanceled(task, message);
            }
            buildFuture = task.buildFuture;
            currentInputStream = task.currentInputStream;
        }

        if (shouldInterrupt && currentInputStream != null) {
            try {
                currentInputStream.close();
            } catch (IOException e) {
                log.debug("关闭已取消文件夹打包的输入流失败: taskId={}", task.taskId, e);
            }
        }
        if (shouldInterrupt && buildFuture != null && !buildFuture.isDone()) {
            buildFuture.cancel(true);
        }
        if (!task.buildStarted && (buildFuture == null || buildFuture.isDone())) {
            task.buildFinished.countDown();
        }

        try {
            if (!task.buildFinished.await(FOLDER_DOWNLOAD_CANCEL_WAIT_SECONDS, TimeUnit.SECONDS)) {
                deleteFolderDownloadZip(task.zipPath);
                log.warn("文件夹打包取消后仍在退出，交由后台清理: taskId={}", task.taskId);
                return true;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("等待文件夹打包取消被中断: taskId={}", task.taskId);
            return true;
        }

        deleteFolderDownloadZip(task.zipPath);
        folderDownloadTasks.remove(task.taskId, task);
        return true;
    }

    private void releaseFolderDownload(FolderDownloadTask task) {
        boolean finished;
        synchronized (task) {
            if (task.activeDownloadCount > 0) {
                task.activeDownloadCount--;
            }
            task.lastActivityAt = System.currentTimeMillis();
            finished = task.activeDownloadCount == 0;
        }
        if (finished) {
            deleteFolderDownloadZip(task.zipPath);
            folderDownloadTasks.remove(task.taskId, task);
        }
    }

    private boolean isFolderDownloadTaskActive(String status) {
        return "queued".equals(status) || "scanning".equals(status) || "packing".equals(status);
    }

    private Path createFolderDownloadZipPath(String prefix) throws IOException {
        Path tempDirectory = resolveFolderDownloadTempDirectory();
        Files.createDirectories(tempDirectory);
        return Files.createTempFile(tempDirectory, prefix, ".zip");
    }

    private Path resolveFolderDownloadTempDirectory() {
        if (StringUtils.isEmpty(folderDownloadTempDir)) {
            return Path.of(System.getProperty("java.io.tmpdir"), "free-fs-folder-download")
                    .toAbsolutePath().normalize();
        }
        return Path.of(folderDownloadTempDir).toAbsolutePath().normalize();
    }

    private Path normalizePath(Path path) {
        return path == null ? null : path.toAbsolutePath().normalize();
    }

    private void addProtectedPath(Set<Path> protectedPaths, Path path) {
        if (path != null) {
            protectedPaths.add(path);
        }
    }

    private boolean isFolderDownloadZipFile(Path path) {
        if (path == null || path.getFileName() == null) {
            return false;
        }
        String fileName = path.getFileName().toString();
        return fileName.endsWith(".zip")
                && (fileName.startsWith(FOLDER_DOWNLOAD_TASK_PREFIX)
                || fileName.startsWith(FOLDER_DOWNLOAD_DIRECT_PREFIX));
    }

    private boolean isAllowedFolderDownloadTempPath(Path path) {
        Path normalized = normalizePath(path);
        if (normalized == null || !isFolderDownloadZipFile(normalized)) {
            return false;
        }
        Path dedicatedDirectory = resolveFolderDownloadTempDirectory();
        Path legacyDirectory = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        Path parent = normalized.getParent();
        return normalized.startsWith(dedicatedDirectory)
                || (parent != null && parent.equals(legacyDirectory));
    }

    private void deleteFolderDownloadZip(Path path) {
        if (path == null) {
            return;
        }
        if (!isAllowedFolderDownloadTempPath(path)) {
            log.warn("拒绝删除非文件夹下载临时文件: {}", path);
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("删除文件夹下载临时文件失败: {}", path, e);
        }
    }

    private void cleanupStaleActiveFolderDownloadStreams(long now) {
        for (DeleteOnCloseInputStream inputStream : activeFolderDownloadStreams.values()) {
            if (now - inputStream.getLastActivityAt() > FOLDER_DOWNLOAD_TASK_TTL_MS) {
                try {
                    inputStream.close();
                } catch (IOException e) {
                    log.warn("关闭超时文件夹下载流失败", e);
                }
            }
        }
    }

    private void cleanupOrphanFolderDownloadFiles(Set<Path> protectedPaths, long now) {
        Set<Path> scanDirectories = new LinkedHashSet<>();
        scanDirectories.add(resolveFolderDownloadTempDirectory());
        scanDirectories.add(Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize());

        for (Path directory : scanDirectories) {
            if (!Files.isDirectory(directory)) {
                continue;
            }
            try (DirectoryStream<Path> paths = Files.newDirectoryStream(directory, this::isFolderDownloadZipFile)) {
                for (Path path : paths) {
                    Path normalized = normalizePath(path);
                    if (protectedPaths.contains(normalized) || !Files.isRegularFile(normalized)) {
                        continue;
                    }
                    long lastModifiedAt = Files.getLastModifiedTime(normalized).toMillis();
                    if (now - lastModifiedAt > FOLDER_DOWNLOAD_TASK_TTL_MS) {
                        deleteFolderDownloadZip(normalized);
                        log.info("清理孤立文件夹下载临时文件: {}", normalized);
                    }
                }
            } catch (IOException e) {
                log.warn("扫描文件夹下载临时目录失败: {}", directory, e);
            }
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void cleanupFolderDownloadTasksOnStartup() {
        log.info("应用启动，开始检查文件夹下载临时文件");
        cleanupExpiredFolderDownloadTasks(true);
    }

    @Scheduled(fixedDelay = FOLDER_DOWNLOAD_CLEANUP_INTERVAL_MS,
            initialDelay = FOLDER_DOWNLOAD_CLEANUP_INTERVAL_MS)
    public void scheduledFolderDownloadCleanup() {
        cleanupExpiredFolderDownloadTasks(true);
    }

    private void cleanupExpiredFolderDownloadTasks() {
        cleanupExpiredFolderDownloadTasks(false);
    }

    private void cleanupExpiredFolderDownloadTasks(boolean scanOrphanFiles) {
        long now = System.currentTimeMillis();
        cleanupStaleActiveFolderDownloadStreams(now);
        Set<Path> protectedPaths = new HashSet<>(activeFolderDownloadPaths);
        activeFolderDownloadStreams.values().forEach(inputStream ->
                addProtectedPath(protectedPaths, normalizePath(inputStream.getPath())));

        for (Map.Entry<String, FolderDownloadTask> entry : folderDownloadTasks.entrySet()) {
            FolderDownloadTask task = entry.getValue();
            boolean shouldCancel = false;
            boolean shouldRemove = false;

            synchronized (task) {
                Path taskPath = normalizePath(task.zipPath);
                boolean buildFinished = task.buildFinished.getCount() == 0;

                if (task.activeDownloadCount > 0 || "downloading".equals(task.status)) {
                    addProtectedPath(protectedPaths, taskPath);
                } else if (isFolderDownloadTaskActive(task.status)) {
                    if (now - task.lastActivityAt > FOLDER_DOWNLOAD_TASK_TTL_MS) {
                        shouldCancel = true;
                    } else {
                        addProtectedPath(protectedPaths, taskPath);
                    }
                } else if ("completed".equals(task.status)) {
                    if (buildFinished && now - task.completedAt > FOLDER_DOWNLOAD_TASK_TTL_MS) {
                        task.status = "expired";
                        task.message = "下载文件已过期";
                        shouldRemove = true;
                    } else {
                        addProtectedPath(protectedPaths, taskPath);
                    }
                } else if (("failed".equals(task.status) || "canceled".equals(task.status)) && buildFinished) {
                    shouldRemove = true;
                } else if ("canceled".equals(task.status)
                        && now - task.lastActivityAt > FOLDER_DOWNLOAD_TASK_TTL_MS) {
                    shouldCancel = true;
                } else {
                    addProtectedPath(protectedPaths, taskPath);
                }
            }

            if (shouldCancel) {
                log.warn("文件夹打包任务超过2小时无活动，自动取消: taskId={}", task.taskId);
                boolean canceled = cancelFolderDownloadTaskInternal(
                        task, "文件夹打包超时，已自动取消", false);
                if (!canceled) {
                    synchronized (task) {
                        addProtectedPath(protectedPaths, normalizePath(task.zipPath));
                    }
                }
            } else if (shouldRemove) {
                deleteFolderDownloadZip(task.zipPath);
                folderDownloadTasks.remove(entry.getKey(), task);
            }
        }

        if (scanOrphanFiles) {
            cleanupOrphanFolderDownloadFiles(protectedPaths, now);
        }
    }

    public FileDownloadVO downloadDirectory(FileInfo dirInfo) {
        Path zipPath = null;
        Path activeZipPath = null;
        String streamId = null;
        try {
            zipPath = createFolderDownloadZipPath(FOLDER_DOWNLOAD_DIRECT_PREFIX);
            activeZipPath = normalizePath(zipPath);
            activeFolderDownloadPaths.add(activeZipPath);
            try (ZipOutputStream zipOutputStream = new ZipOutputStream(Files.newOutputStream(zipPath))) {
                writeDirectoryToZip(dirInfo, sanitizeZipName(dirInfo.getDisplayName()), zipOutputStream, new HashSet<>());
            }

            long zipSize = Files.size(zipPath);
            streamId = IdUtil.fastSimpleUUID();
            String downloadStreamId = streamId;
            Path downloadZipPath = activeZipPath;
            DeleteOnCloseInputStream managedInputStream = new DeleteOnCloseInputStream(
                    Files.newInputStream(zipPath),
                    zipPath,
                    true,
                    () -> {
                        activeFolderDownloadStreams.remove(downloadStreamId);
                        activeFolderDownloadPaths.remove(downloadZipPath);
                    }
            );
            activeFolderDownloadStreams.put(downloadStreamId, managedInputStream);
            InputStream inputStream = managedInputStream;
            FileDownloadVO downloadVO = new FileDownloadVO();
            downloadVO.setFileName(buildZipFileName(dirInfo.getDisplayName()));
            downloadVO.setFileSize(zipSize);
            downloadVO.setResource(new InputStreamResource(inputStream));
            return downloadVO;
        } catch (Exception e) {
            if (streamId != null) {
                activeFolderDownloadStreams.remove(streamId);
            }
            if (activeZipPath != null) {
                activeFolderDownloadPaths.remove(activeZipPath);
            }
            deleteFolderDownloadZip(zipPath);
            throw new StorageOperationException(ErrorMessages.FOLDER_DOWNLOAD_FAILED, e);
        }
    }

    private void writeDirectoryToZip(FileInfo dirInfo, String dirPath,
                                     ZipOutputStream zipOutputStream, Set<String> visitedDirIds) throws IOException {
        if (!visitedDirIds.add(dirInfo.getId())) {
            return;
        }

        String normalizedDirPath = ensureTrailingSlash(dirPath);
        zipOutputStream.putNextEntry(new ZipEntry(normalizedDirPath));
        zipOutputStream.closeEntry();

        for (FileInfo child : listDirectoryChildren(dirInfo)) {
            String childPath = normalizedDirPath + sanitizeZipName(child.getDisplayName());
            if (Boolean.TRUE.equals(child.getIsDir())) {
                writeDirectoryToZip(child, childPath, zipOutputStream, visitedDirIds);
            } else {
                writeFileToZip(child, childPath, zipOutputStream);
            }
        }
    }

    private void writeFileToZip(FileInfo fileInfo, String zipEntryName, ZipOutputStream zipOutputStream) throws IOException {
        IStorageOperationService storageService = storageServiceFacade.getStorageService(fileInfo.getStoragePlatformSettingId());
        if (!storageService.isFileExist(fileInfo.getObjectKey())) {
            log.warn("文件夹打包时跳过不存在的文件: fileId={}, objectKey={}", fileInfo.getId(), fileInfo.getObjectKey());
            return;
        }

        zipOutputStream.putNextEntry(new ZipEntry(zipEntryName));
        try (InputStream inputStream = storageService.downloadFile(fileInfo.getObjectKey())) {
            inputStream.transferTo(zipOutputStream);
        } finally {
            zipOutputStream.closeEntry();
        }
    }

    public FileInfo resolveDownloadFile(String fileId) {
        if (storageMountService.isVirtual(fileId)) {
            return fileInfoService.getAuthorizedFile(fileId);
        }
        return fileInfoService.getById(fileId);
    }

    private List<FileInfo> listDirectoryChildren(FileInfo dirInfo) {
        if (storageMountService.isS3Container(dirInfo.getId())) {
            return storageMountService.listS3(dirInfo.getId(), null).stream()
                    .map(item -> {
                        FileInfo child = new FileInfo();
                        child.setId(item.getId());
                        child.setDisplayName(item.getDisplayName());
                        child.setOriginalName(item.getOriginalName());
                        child.setObjectKey(item.getObjectKey());
                        child.setIsDir(item.getIsDir());
                        child.setSize(item.getSize());
                        child.setSuffix(item.getSuffix());
                        child.setMimeType(item.getMimeType());
                        child.setStoragePlatformSettingId(dirInfo.getStoragePlatformSettingId());
                        child.setWorkspaceId(dirInfo.getWorkspaceId());
                        child.setIsDeleted(false);
                        return child;
                    })
                    .toList();
        }
        return fileInfoMapper.selectDirectoryChildren(
                dirInfo.getId(), dirInfo.getWorkspaceId(), dirInfo.getStoragePlatformSettingId());
    }

    private String sanitizeZipName(String name) {
        String safeName = StringUtils.isEmpty(name) ? "未命名" : name;
        safeName = safeName.replace("\\", "/");
        safeName = safeName.replaceAll("^/+", "");
        safeName = safeName.replace("../", "");
        return safeName.replace("/", "_");
    }

    private String ensureTrailingSlash(String path) {
        return path.endsWith("/") ? path : path + "/";
    }

    private String buildZipFileName(String displayName) {
        String safeName = StringUtils.isEmpty(displayName) ? "文件夹" : displayName;
        return safeName.toLowerCase(Locale.ROOT).endsWith(".zip") ? safeName : safeName + ".zip";
    }

    private static class DeleteOnCloseInputStream extends FilterInputStream {
        private final Path path;
        private final boolean deletePathOnClose;
        private final Runnable onClose;
        private volatile long lastActivityAt = System.currentTimeMillis();
        private boolean closed;

        protected DeleteOnCloseInputStream(InputStream in, Path path, boolean deletePathOnClose,
                                          Runnable onClose) {
            super(in);
            this.path = path;
            this.deletePathOnClose = deletePathOnClose;
            this.onClose = onClose;
        }

        private Path getPath() {
            return path;
        }

        @Override
        public int read() throws IOException {
            int value = super.read();
            lastActivityAt = System.currentTimeMillis();
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int count = super.read(buffer, offset, length);
            lastActivityAt = System.currentTimeMillis();
            return count;
        }

        private long getLastActivityAt() {
            return lastActivityAt;
        }

        @Override
        public synchronized void close() throws IOException {
            if (closed) {
                return;
            }
            closed = true;
            try {
                super.close();
            } finally {
                try {
                    if (deletePathOnClose) {
                        Files.deleteIfExists(path);
                    }
                } finally {
                    if (onClose != null) {
                        onClose.run();
                    }
                }
            }
        }
    }

    private static class FolderDownloadCanceledException extends IOException {
        private FolderDownloadCanceledException(String message) {
            super(message);
        }
    }

    private static class FolderDownloadTask {
        private String taskId;
        private String userId;
        private String workspaceId;
        private String storagePlatformSettingId;
        private String folderId;
        private String folderName;
        private volatile String status;
        private Integer progress;
        private Integer totalFiles;
        private Integer processedFiles;
        private Long totalBytes;
        private Long processedBytes;
        private Long zipSize;
        private String zipFileName;
        private volatile Path zipPath;
        private String message;
        private String errorMessage;
        private long createdAt;
        private long updatedAt;
        private long completedAt;
        private long lastActivityAt;
        private long downloadStartedAt;
        private int activeDownloadCount;
        private volatile boolean cancelRequested;
        private volatile boolean buildStarted;
        private volatile Future<?> buildFuture;
        private volatile InputStream currentInputStream;
        private final CountDownLatch buildFinished = new CountDownLatch(1);
    }

    private static class FolderDownloadScanResult {
        private int totalFiles;
        private long totalBytes;
    }
}
