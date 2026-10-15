/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage.plugin.s3;

import com.xddcodec.fs.Exception.StorageConfigException;
import com.xddcodec.fs.Exception.StorageOperationException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * S3兼容存储抽象服务
 * 封装AWS S3 SDK的通用逻辑
 *
 * @param <T> 具体的S3兼容配置类型
 * @Author: xddcode
 * @Date: 2026/01/12 22:06
 */
@Slf4j
public class S3StorageService implements com.xddcodec.fs.storage.plugin.core.IStorageOperationService {

    protected S3Client s3Client;
    protected S3Presigner s3Presigner;
    protected String bucketName;
    protected S3Settings s3Config;

    public S3StorageService(Map<String, Object> properties) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.s3Config = mapper.convertValue(properties, S3Settings.class);
        validateConfig();
        initialize();
    }

    public static class S3Settings {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;
        private String region;
        private Boolean pathStyleAccess = Boolean.TRUE;
        private String customDomain;

        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public Boolean getPathStyleAccess() { return pathStyleAccess; }
        public void setPathStyleAccess(Boolean pathStyleAccess) { this.pathStyleAccess = pathStyleAccess; }
        public String getCustomDomain() { return customDomain; }
        public void setCustomDomain(String customDomain) { this.customDomain = customDomain; }

        public software.amazon.awssdk.regions.Region resolveRegion() {
            if (region == null || region.trim().isEmpty()) {
                return software.amazon.awssdk.regions.Region.US_EAST_1;
            }
            return software.amazon.awssdk.regions.Region.of(region.trim());
        }
    }

    private String getLogPrefix() {
        return "[S3]";
    }

    private void ensureNotPrototype() {
    }

    private void validateConfig() {
        try {
            if (s3Config == null) {
                throw new StorageConfigException("S3配置转换失败，配置对象为空");
            }

            // 通用校验
            if (s3Config.getEndpoint() == null || s3Config.getEndpoint().trim().isEmpty()) {
                throw new StorageConfigException("endpoint 不能为空");
            }
            if (s3Config.getAccessKey() == null || s3Config.getAccessKey().trim().isEmpty()) {
                throw new StorageConfigException("accessKey 不能为空");
            }
            if (s3Config.getSecretKey() == null || s3Config.getSecretKey().trim().isEmpty()) {
                throw new StorageConfigException("secretKey 不能为空");
            }
            if (s3Config.getBucket() == null || s3Config.getBucket().trim().isEmpty()) {
                throw new StorageConfigException("bucket 不能为空");
            }

        } catch (StorageConfigException e) {
            throw e;
        } catch (Exception e) {
            log.error("S3配置验证失败: {}", e.getMessage(), e);
            throw new StorageConfigException("存储平台配置错误：" + e.getMessage());
        }
    }

    private void initialize() {
        try {
            // 构建凭证
            AwsBasicCredentials credentials = AwsBasicCredentials.create(
                    s3Config.getAccessKey(),
                    s3Config.getSecretKey()
            );
            // 构建S3配置
            S3Configuration.Builder s3ConfigBuilder = S3Configuration.builder()
                    .pathStyleAccessEnabled(s3Config.getPathStyleAccess() == null || s3Config.getPathStyleAccess());
//            // 构建HTTP客户端
//            SdkHttpClient.Builder httpClientBuilder = SdkHttpClient.builder()
//                    .connectionTimeout(Duration.ofSeconds(s3Config.getConnectionTimeout()))
//                    .socketTimeout(Duration.ofSeconds(s3Config.getSocketTimeout()));
            // 构建S3客户端
            this.s3Client = S3Client.builder()
                    .region(s3Config.resolveRegion())
                    .endpointOverride(URI.create(s3Config.getEndpoint()))
                    .credentialsProvider(StaticCredentialsProvider.create(credentials))
                    .serviceConfiguration(s3ConfigBuilder.build())
//                    .httpClientBuilder(httpClientBuilder)
                    .build();
            // 构建预签名URL生成器
            this.s3Presigner = S3Presigner.builder()
                    .region(s3Config.resolveRegion())
                    .endpointOverride(URI.create(s3Config.getEndpoint()))
                    .credentialsProvider(StaticCredentialsProvider.create(credentials))
                    .serviceConfiguration(s3ConfigBuilder.build())
                    .build();
            this.bucketName = s3Config.getBucket();
            log.info("{} S3客户端初始化成功: endpoint={}, bucket={}",
                    getLogPrefix(), s3Config.getEndpoint(), this.bucketName);
        } catch (StorageConfigException e) {
            throw e;
        } catch (Exception e) {
            log.error("S3客户端初始化失败: {}", e.getMessage(), e);
            throw new StorageConfigException("存储平台配置错误：客户端初始化失败");
        }
    }

    @Override
    public void uploadFile(InputStream inputStream, String objectKey) {
        ensureNotPrototype();
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.putObject(request, RequestBody.fromInputStream(inputStream, inputStream.available()));
            log.debug("{} 文件上传成功: objectKey={}", getLogPrefix(), objectKey);
        } catch (Exception e) {
            log.error("{} 文件上传失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3文件上传失败: " + e.getMessage(), e);
        }
    }

    @Override
    public InputStream downloadFile(String objectKey) {
        ensureNotPrototype();
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            InputStream stream = s3Client.getObject(request, ResponseTransformer.toInputStream());
            log.debug("{} 文件下载成功: objectKey={}", getLogPrefix(), objectKey);
            return stream;
        } catch (NoSuchKeyException e) {
            throw new StorageOperationException("文件不存在: " + objectKey, e);
        } catch (Exception e) {
            log.error("{} 文件下载失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3文件下载失败: " + e.getMessage(), e);
        }
    }

    @Override
    public InputStream downloadFileRange(String objectKey, long startByte, long endByte) {
        ensureNotPrototype();
        try {
            if (startByte < 0 || endByte < startByte) {
                throw new StorageOperationException("无效的字节范围: startByte=" + startByte + ", endByte=" + endByte);
            }

            // 构建 Range 请求头：bytes=startByte-endByte
            String range = "bytes=" + startByte + "-" + endByte;
            
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .range(range)
                    .build();
            
            InputStream stream = s3Client.getObject(request, ResponseTransformer.toInputStream());
            
            log.debug("{} Range读取文件成功: objectKey={}, range={}", 
                    getLogPrefix(), objectKey, range);
            
            return stream;
        } catch (NoSuchKeyException e) {
            throw new StorageOperationException("文件不存在: " + objectKey, e);
        } catch (S3Exception e) {
            log.error("{} S3 Range读取失败: objectKey={}, startByte={}, endByte={}, errorCode={}", 
                    getLogPrefix(), objectKey, startByte, endByte, e.awsErrorDetails().errorCode(), e);
            throw new StorageOperationException("S3 Range读取文件失败: " + e.awsErrorDetails().errorMessage(), e);
        } catch (Exception e) {
            log.error("{} Range读取文件失败: objectKey={}, startByte={}, endByte={}", 
                    getLogPrefix(), objectKey, startByte, endByte, e);
            throw new StorageOperationException("S3 Range读取文件失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void deleteFile(String objectKey) {
        ensureNotPrototype();
        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.deleteObject(request);
            log.debug("{} 文件删除成功: objectKey={}", getLogPrefix(), objectKey);
        } catch (Exception e) {
            log.error("{} 文件删除失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3文件删除失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void rename(String objectKey, String newFileName) {
        ensureNotPrototype();
        try {
            // S3不支持重命名，需要拷贝后删除
            String newKey = objectKey.substring(0, objectKey.lastIndexOf('/') + 1) + newFileName;
            CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                    .sourceBucket(bucketName)
                    .sourceKey(objectKey)
                    .destinationBucket(bucketName)
                    .destinationKey(newKey)
                    .build();
            s3Client.copyObject(copyRequest);
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.deleteObject(deleteRequest);
            log.debug("{} 文件重命名成功: {} -> {}", getLogPrefix(), objectKey, newKey);
        } catch (Exception e) {
            log.error("{} 文件重命名失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3文件重命名失败: " + e.getMessage(), e);
        }
    }

    @Override
    public String getFileUrl(String objectKey, Integer expireSeconds) {
        return getFileUrl(objectKey, expireSeconds, null);
    }

    @Override
    public String getFileUrl(String objectKey, Integer expireSeconds, String downloadFileName) {
        ensureNotPrototype();
        try {
            boolean forceDownload = downloadFileName != null && !downloadFileName.isEmpty();
            if (!forceDownload && s3Config.getCustomDomain() != null && !s3Config.getCustomDomain().isEmpty()) {
                return s3Config.getCustomDomain() + "/" + objectKey;
            }
            Duration expiration = expireSeconds != null
                    ? Duration.ofSeconds(expireSeconds)
                    : Duration.ofHours(1);
            GetObjectRequest.Builder objectBuilder = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey);
            if (downloadFileName != null && !downloadFileName.isEmpty()) {
                objectBuilder.responseContentDisposition(contentDisposition(downloadFileName));
            }
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(expiration)
                    .getObjectRequest(objectBuilder.build())
                    .build();
            PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);
            return presignedRequest.url().toString();
        } catch (Exception e) {
            log.error("{} 生成文件URL失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3生成文件URL失败: " + e.getMessage(), e);
        }
    }

    private static String contentDisposition(String fileName) {
        String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                .replace("+", "%20");
        return "attachment; filename*=UTF-8''" + encoded;
    }

    @Override
    public InputStream getFileStream(String objectKey) {
        return downloadFile(objectKey);
    }

    @Override
    public boolean isFileExist(String objectKey) {
        ensureNotPrototype();
        try {
            HeadObjectRequest request = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.headObject(request);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (Exception e) {
            log.error("{} 检查文件存在失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("检查文件存在失败: " + e.getMessage(), e);
        }
    }

    public String initiateMultipartUpload(String objectKey, String mimeType) {
        ensureNotPrototype();
        try {
            CreateMultipartUploadRequest.Builder requestBuilder = CreateMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey);
            if (mimeType != null && !mimeType.isEmpty()) {
                requestBuilder.contentType(mimeType);
            }
            CreateMultipartUploadResponse response = s3Client.createMultipartUpload(requestBuilder.build());
            return response.uploadId();
        } catch (Exception e) {
            log.error("{} 初始化分片上传失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3初始化分片上传失败: " + e.getMessage(), e);
        }
    }

    public String uploadPart(String objectKey, String uploadId, int partNumber,
                             long partSize, InputStream partInputStream) {
        ensureNotPrototype();
        try {
            UploadPartRequest request = UploadPartRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .partNumber(partNumber + 1) // AWS SDK partNumber从1开始
                    .build();
            UploadPartResponse response = s3Client.uploadPart(request,
                    RequestBody.fromInputStream(partInputStream, partSize));
            String eTag = response.eTag();
            log.debug("{} 分片上传成功: objectKey={}, partNumber={}, eTag={}",
                    getLogPrefix(), objectKey, partNumber, eTag);
            return eTag;
        } catch (Exception e) {
            log.error("{} 分片上传失败: objectKey={}, partNumber={}",
                    getLogPrefix(), objectKey, partNumber, e);
            throw new StorageOperationException("S3分片上传失败: " + e.getMessage(), e);
        }
    }

    public Set<Integer> listParts(String objectKey, String uploadId) {
        ensureNotPrototype();
        try {
            ListPartsRequest request = ListPartsRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .build();
            ListPartsResponse response = s3Client.listParts(request);
            return response.parts().stream()
                    .map(Part::partNumber)
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            log.warn("{} 列举分片失败，返回空集合: {}", getLogPrefix(), e.getMessage());
            return Collections.emptySet();
        }
    }

    public void completeMultipartUpload(String objectKey, String uploadId,
                                        List<Map<String, Object>> partETags) {
        ensureNotPrototype();
        try {
            List<CompletedPart> completedParts = partETags.stream()
                    .map(map -> CompletedPart.builder()
                            .partNumber((int) map.get("partNumber") + 1)
                            .eTag((String) map.get("eTag"))
                            .build())
                    .collect(Collectors.toList());
            CompletedMultipartUpload completedUpload = CompletedMultipartUpload.builder()
                    .parts(completedParts)
                    .build();
            CompleteMultipartUploadRequest request = CompleteMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .multipartUpload(completedUpload)
                    .build();
            s3Client.completeMultipartUpload(request);
            log.info("{} 分片合并成功: objectKey={}, uploadId={}",
                    getLogPrefix(), objectKey, uploadId);
        } catch (Exception e) {
            log.error("{} 分片合并失败: objectKey={}, uploadId={}",
                    getLogPrefix(), objectKey, uploadId, e);
            throw new StorageOperationException("S3分片合并失败: " + e.getMessage(), e);
        }
    }

    public void abortMultipartUpload(String objectKey, String uploadId) {
        ensureNotPrototype();
        try {
            AbortMultipartUploadRequest request = AbortMultipartUploadRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .uploadId(uploadId)
                    .build();
            s3Client.abortMultipartUpload(request);
            log.info("{} 分片上传已取消: objectKey={}, uploadId={}",
                    getLogPrefix(), objectKey, uploadId);
        } catch (Exception e) {
            log.error("{} 取消分片上传失败: objectKey={}, uploadId={}",
                    getLogPrefix(), objectKey, uploadId, e);
            throw new StorageOperationException("S3取消分片上传失败: " + e.getMessage(), e);
        }
    }

    /**
     * 按 delimiter 列出一层。prefix 为空表示桶根目录。
     */
    public List<S3ListedObject> listChildren(String prefix) {
        ensureNotPrototype();
        String normalized = normalizePrefix(prefix);
        List<S3ListedObject> items = new ArrayList<>();
        String token = null;
        try {
            do {
                ListObjectsV2Request.Builder builder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(normalized)
                        .delimiter("/");
                if (token != null) {
                    builder.continuationToken(token);
                }
                ListObjectsV2Response page = s3Client.listObjectsV2(builder.build());
                if (page.commonPrefixes() != null) {
                    for (CommonPrefix common : page.commonPrefixes()) {
                        String key = common.prefix();
                        String name = key.substring(normalized.length());
                        if (name.endsWith("/")) {
                            name = name.substring(0, name.length() - 1);
                        }
                        if (!name.isEmpty()) {
                            items.add(new S3ListedObject(name, key, true, 0L, null));
                        }
                    }
                }
                if (page.contents() != null) {
                    for (S3Object object : page.contents()) {
                        if (object.key().equals(normalized) || object.key().endsWith("/")) {
                            continue;
                        }
                        String name = object.key().substring(normalized.length());
                        if (name.isEmpty() || name.indexOf('/') >= 0) {
                            continue;
                        }
                        items.add(new S3ListedObject(
                                name,
                                object.key(),
                                false,
                                object.size() == null ? 0L : object.size(),
                                object.lastModified()));
                    }
                }
                token = Boolean.TRUE.equals(page.isTruncated()) ? page.nextContinuationToken() : null;
            } while (token != null);
            return items;
        } catch (Exception e) {
            log.error("{} 列举对象失败: prefix={}", getLogPrefix(), normalized, e);
            throw new StorageOperationException("S3列举文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 递归列出前缀下的全部对象，包含以 / 结尾的目录占位。
     */
    public List<S3ListedObject> listAll(String prefix) {
        ensureNotPrototype();
        String normalized = normalizePrefix(prefix);
        List<S3ListedObject> items = new ArrayList<>();
        String token = null;
        try {
            do {
                ListObjectsV2Request.Builder builder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(normalized);
                if (token != null) {
                    builder.continuationToken(token);
                }
                ListObjectsV2Response page = s3Client.listObjectsV2(builder.build());
                if (page.contents() != null) {
                    for (S3Object object : page.contents()) {
                        if (object.key().equals(normalized)) {
                            continue;
                        }
                        boolean directory = object.key().endsWith("/");
                        String relative = object.key().substring(normalized.length());
                        items.add(new S3ListedObject(
                                relative,
                                object.key(),
                                directory,
                                object.size() == null ? 0L : object.size(),
                                object.lastModified()));
                    }
                }
                token = Boolean.TRUE.equals(page.isTruncated()) ? page.nextContinuationToken() : null;
            } while (token != null);
            return items;
        } catch (Exception e) {
            log.error("{} 递归列举对象失败: prefix={}", getLogPrefix(), normalized, e);
            throw new StorageOperationException("S3列举文件失败: " + e.getMessage(), e);
        }
    }

    public void copyObject(String sourceKey, String destKey) {
        ensureNotPrototype();
        if (sourceKey.equals(destKey)) {
            return;
        }
        try {
            s3Client.copyObject(CopyObjectRequest.builder()
                    .sourceBucket(bucketName)
                    .sourceKey(sourceKey)
                    .destinationBucket(bucketName)
                    .destinationKey(destKey)
                    .build());
        } catch (Exception e) {
            log.error("{} 拷贝对象失败: {} -> {}", getLogPrefix(), sourceKey, destKey, e);
            throw new StorageOperationException("S3拷贝文件失败: " + e.getMessage(), e);
        }
    }

    public void uploadSized(InputStream inputStream, String objectKey, long size) {
        ensureNotPrototype();
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();
            s3Client.putObject(request, RequestBody.fromInputStream(inputStream, Math.max(size, 0)));
        } catch (Exception e) {
            log.error("{} 按长度上传失败: objectKey={}", getLogPrefix(), objectKey, e);
            throw new StorageOperationException("S3文件上传失败: " + e.getMessage(), e);
        }
    }

    public long contentLength(String objectKey) {
        ensureNotPrototype();
        try {
            return s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build()).contentLength();
        } catch (Exception e) {
            throw new StorageOperationException("S3读取文件大小失败: " + e.getMessage(), e);
        }
    }

    public void deletePrefix(String prefix) {
        ensureNotPrototype();
        String normalized = normalizePrefix(prefix);
        String token = null;
        try {
            do {
                ListObjectsV2Request.Builder builder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(normalized);
                if (token != null) {
                    builder.continuationToken(token);
                }
                ListObjectsV2Response page = s3Client.listObjectsV2(builder.build());
                if (page.contents() != null) {
                    for (S3Object object : page.contents()) {
                        deleteFile(object.key());
                    }
                }
                token = Boolean.TRUE.equals(page.isTruncated()) ? page.nextContinuationToken() : null;
            } while (token != null);
        } catch (StorageOperationException e) {
            throw e;
        } catch (Exception e) {
            throw new StorageOperationException("S3删除目录失败: " + e.getMessage(), e);
        }
    }

    public void putPlaceholder(String directoryKey) {
        String key = directoryKey.endsWith("/") ? directoryKey : directoryKey + "/";
        uploadSized(new java.io.ByteArrayInputStream(new byte[0]), key, 0);
    }

    private static String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isEmpty()) {
            return "";
        }
        return prefix.endsWith("/") ? prefix : prefix + "/";
    }

    public record S3ListedObject(String name, String key, boolean directory, long size, java.time.Instant modified) {
    }

    @Override
    public void close() {
        if (s3Client != null) {
            s3Client.close();
        }
        if (s3Presigner != null) {
            s3Presigner.close();
        }
    }
}
