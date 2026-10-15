/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.plugin.local;

import com.xddcodec.fs.Exception.StorageOperationException;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.io.*;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "fs.storage.local")
public class LocalStorageOperationService implements IStorageOperationService {

    public static final String PROJECT_UPLOADS_RELATIVE =
            "Common/src/main/java/com/xddcodec/fs/uploads";

    private String basePath = PROJECT_UPLOADS_RELATIVE;
    private String baseUrl = "http://localhost:8080/files";

    @PostConstruct
    public void init() {
        Path configured = Paths.get(basePath);
        if (!configured.isAbsolute()) {
            this.basePath = resolveAgainstProjectRoot(configured).toString();
        } else {
            this.basePath = configured.normalize().toString();
        }
        this.basePath = normalizePath(this.basePath, File.separator, "basePath 不能为空");
        this.baseUrl = normalizePath(this.baseUrl, "/", "baseUrl 不能为空");
        File baseDir = new File(this.basePath);
        if (!baseDir.exists() && !baseDir.mkdirs()) {
            throw new StorageOperationException("无法创建存储目录: " + this.basePath);
        }
        log.info("Local 存储目录: {}", this.basePath);
    }

    private static Path resolveAgainstProjectRoot(Path relative) {
        Path dir = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (dir != null) {
            Path marker = dir.resolve("Common/src/main/java/com/xddcodec/fs");
            if (Files.isDirectory(marker)) {
                return dir.resolve(relative).normalize();
            }
            dir = dir.getParent();
        }
        return Paths.get(System.getProperty("user.dir")).resolve(relative).normalize();
    }

    private void ensureNotPrototype() {
    }

    private String getLogPrefix() {
        return "[Local]";
    }

    /**
     * 规范化路径（去除末尾分隔符）
     */
    private String normalizePath(String path, String separator, String errorMsg) {
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException(errorMsg);
        }
        String trimmed = path.trim();
        return trimmed.endsWith(separator)
                ? trimmed.substring(0, trimmed.length() - separator.length())
                : trimmed;
    }

    /**
     * 解析完整文件路径
     */
    private String resolveFullPath(String objectKey) {
        String normalizedObjectKey = objectKey.startsWith("/") || objectKey.startsWith("\\")
                ? objectKey.substring(1)
                : objectKey;
        return basePath + File.separator + normalizedObjectKey;
    }

    @Override
    public void uploadFile(InputStream inputStream, String objectKey) {
        ensureNotPrototype();
        try {
            String fullPath = resolveFullPath(objectKey);
            File targetFile = new File(fullPath);

            File parentDir = targetFile.getParentFile();
            if (parentDir != null && !parentDir.exists() && !parentDir.mkdirs()) {
                throw new StorageOperationException("无法创建目录: " + parentDir);
            }

            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                inputStream.transferTo(fos);
            }

            log.debug("{} 文件上传成功: objectKey={}", getLogPrefix(), objectKey);
        } catch (IOException e) {
            throw new StorageOperationException("文件上传失败: " + e.getMessage(), e);
        }
    }

    @Override
    public InputStream downloadFile(String objectKey) {
        ensureNotPrototype();

        try {
            String fullPath = resolveFullPath(objectKey);
            File file = new File(fullPath);

            if (!file.exists()) {
                throw new StorageOperationException("文件不存在: " + objectKey);
            }

            return new FileInputStream(file);
        } catch (IOException e) {
            throw new StorageOperationException("文件下载失败: " + e.getMessage(), e);
        }
    }

    @Override
    public InputStream downloadFileRange(String objectKey, long startByte, long endByte) {
        ensureNotPrototype();

        try {
            String fullPath = resolveFullPath(objectKey);
            File file = new File(fullPath);

            if (!file.exists()) {
                throw new StorageOperationException("文件不存在: " + objectKey);
            }

            if (startByte < 0 || endByte < startByte) {
                throw new StorageOperationException("无效的字节范围: startByte=" + startByte + ", endByte=" + endByte);
            }

            if (startByte >= file.length()) {
                throw new StorageOperationException("起始字节超出文件大小: startByte=" + startByte + ", fileSize=" + file.length());
            }

            // 使用 RandomAccessFile 定位到起始字节
            RandomAccessFile raf = new RandomAccessFile(file, "r");
            raf.seek(startByte);
            
            // 计算需要读取的字节数
            long length = Math.min(endByte - startByte + 1, file.length() - startByte);
            
            log.debug("{} Range读取文件: objectKey={}, startByte={}, endByte={}, length={}", 
                    getLogPrefix(), objectKey, startByte, endByte, length);
            
            // 返回限制长度的 InputStream
            return new BoundedFileInputStream(raf, length);
        } catch (IOException e) {
            throw new StorageOperationException("Range读取文件失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void deleteFile(String objectKey) {
        ensureNotPrototype();

        try {
            String fullPath = resolveFullPath(objectKey);
            File file = new File(fullPath);

            if (!file.exists()) {
                log.debug("{} 文件不存在，视为删除成功: objectKey={}", getLogPrefix(), objectKey);
            }

            boolean deleted = file.delete();
            if (!deleted) {
                log.error("{} 文件删除失败: objectKey={}", getLogPrefix(), objectKey);
                throw new StorageOperationException("文件删除失败: " + objectKey);
            }

            log.debug("{} 文件删除成功: objectKey={}", getLogPrefix(), objectKey);
        } catch (SecurityException e) {
            log.error("{} 文件删除失败（权限不足）: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("文件删除失败（权限不足）: " + objectKey, e);
        }
    }

    @Override
    public void rename(String objectKey, String newFileName) {

    }

    @Override
    public String getFileUrl(String objectKey, Integer expireSeconds) {
        ensureNotPrototype();
        String normalizedObjectKey = objectKey.startsWith("/")
                ? objectKey.substring(1)
                : objectKey;

        return baseUrl + "/" + normalizedObjectKey;
    }

    public String getRelativeFilePath(String objectKey) {
        ensureNotPrototype();
        String normalizedObjectKey = objectKey.startsWith("/")
                ? objectKey.substring(1)
                : objectKey;
        String urlPath = URI.create(baseUrl).getPath();
        if (urlPath.endsWith("/")) {
            return urlPath + normalizedObjectKey;
        }
        return urlPath + "/" + normalizedObjectKey;
    }

    @Override
    public InputStream getFileStream(String objectKey) {
        ensureNotPrototype();
        try {
            String fullPath = resolveFullPath(objectKey);
            File file = new File(fullPath);
            // 检查文件是否存在
            if (!file.exists()) {
                log.error("{} 文件不存在: objectKey={}, fullPath={}",
                        getLogPrefix(), objectKey, fullPath);
                throw new StorageOperationException("文件不存在: " + objectKey);
            }
            // 检查是否为文件（不是目录）
            if (!file.isFile()) {
                log.error("{} 路径不是文件: objectKey={}, fullPath={}",
                        getLogPrefix(), objectKey, fullPath);
                throw new StorageOperationException("路径不是文件: " + objectKey);
            }
            // 检查文件是否可读
            if (!file.canRead()) {
                log.error("{} 文件不可读: objectKey={}, fullPath={}",
                        getLogPrefix(), objectKey, fullPath);
                throw new StorageOperationException("文件不可读: " + objectKey);
            }
            log.debug("{} 获取文件流: objectKey={}, fileSize={} bytes",
                    getLogPrefix(), objectKey, file.length());
            return new BufferedInputStream(new FileInputStream(file), 8192);
        } catch (FileNotFoundException e) {
            log.error("{} 文件不存在: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("文件不存在: " + objectKey, e);
        } catch (SecurityException e) {
            log.error("{} 文件访问权限不足: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("文件访问权限不足: " + objectKey, e);
        } catch (Exception e) {
            log.error("{} 获取文件流失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("获取文件流失败: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean isFileExist(String objectKey) {
        ensureNotPrototype();
        String fullPath = resolveFullPath(objectKey);
        Path path = Paths.get(fullPath).normalize();
        return Files.exists(path);
    }

    public long fileSize(String objectKey) {
        File file = new File(resolveFullPath(objectKey));
        if (!file.exists() || !file.isFile()) {
            return 0L;
        }
        return file.length();
    }

    public void writeAt(String objectKey, long offset, InputStream inputStream, long length) {
        try {
            String fullPath = resolveFullPath(objectKey);
            File targetFile = new File(fullPath);
            File parentDir = targetFile.getParentFile();
            if (parentDir != null && !parentDir.exists() && !parentDir.mkdirs()) {
                throw new StorageOperationException("无法创建目录: " + parentDir);
            }
            RandomAccessFile raf = new RandomAccessFile(targetFile, "rw");
            try {
                raf.seek(offset);
                byte[] buffer = new byte[8192];
                long remaining = length;
                while (remaining > 0) {
                    int read = inputStream.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                    if (read < 0) {
                        break;
                    }
                    raf.write(buffer, 0, read);
                    remaining = remaining - read;
                }
            } finally {
                raf.close();
            }
        } catch (IOException e) {
            throw new StorageOperationException("本地写入失败: " + e.getMessage(), e);
        }
    }

    /**
     * 限制读取长度的 InputStream 包装类
     * 用于实现 Range 读取功能
     */
    private static class BoundedFileInputStream extends InputStream {
        private final RandomAccessFile raf;
        private long remaining;

        public BoundedFileInputStream(RandomAccessFile raf, long length) {
            this.raf = raf;
            this.remaining = length;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int result = raf.read();
            if (result != -1) {
                remaining--;
            }
            return result;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int toRead = (int) Math.min(len, remaining);
            int bytesRead = raf.read(b, off, toRead);
            if (bytesRead > 0) {
                remaining -= bytesRead;
            }
            return bytesRead;
        }

        @Override
        public void close() throws IOException {
            raf.close();
        }

        @Override
        public int available() throws IOException {
            return (int) Math.min(remaining, Integer.MAX_VALUE);
        }
    }
}
