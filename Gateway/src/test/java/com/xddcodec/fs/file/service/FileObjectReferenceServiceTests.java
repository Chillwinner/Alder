/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.file.mapper.FileInfoMapper;
import com.xddcodec.fs.storage.facade.StorageServiceFacade;
import com.xddcodec.fs.storage.plugin.core.IStorageOperationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileObjectReferenceServiceTests {

    @Mock
    private FileInfoMapper fileInfoMapper;

    @Mock
    private StorageServiceFacade storageServiceFacade;

    @Mock
    private StringRedisTemplate redis;

    @Mock
    private ValueOperations<String, String> valueOps;

    @Mock
    private IStorageOperationService storageService;

    private FileObjectReferenceService referenceService;

    @BeforeEach
    void setUp() {
        referenceService = new FileObjectReferenceService(
                fileInfoMapper,
                storageServiceFacade,
                redis
        );
    }

    @Test
    void shouldReuseObjectReferencedOnlyByRecycleBin() {
        FileInfo recycleFile = file("file-1", "setting-1", "object-key");
        recycleFile.setIsDeleted(true);

        when(fileInfoMapper.selectReusableByContent(eq("md5"), eq(1024L), eq("setting-1")))
                .thenReturn(List.of(recycleFile));
        when(storageServiceFacade.getStorageService("setting-1")).thenReturn(storageService);
        when(storageService.isFileExist("object-key")).thenReturn(true);

        FileInfo result = referenceService.findReusableFile("md5", 1024L, "setting-1");

        assertSame(recycleFile, result);
    }

    @Test
    void shouldKeepPhysicalObjectWhileAnyReferenceExists() {
        FileInfo file = file("file-1", "setting-1", "object-key");
        when(fileInfoMapper.countByObjectKey("object-key", "setting-1")).thenReturn(1L);

        referenceService.deletePhysicalFileIfUnreferenced(file);

        verify(storageServiceFacade, never()).getStorageService(any());
    }

    @Test
    void shouldDeletePhysicalObjectAfterLastReferenceIsRemoved() {
        FileInfo file = file("file-1", "setting-1", "object-key");
        when(fileInfoMapper.countByObjectKey("object-key", "setting-1")).thenReturn(0L);
        when(storageServiceFacade.getStorageService("setting-1")).thenReturn(storageService);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        when(redis.execute(any(), any(), any())).thenReturn(1L);

        referenceService.deletePhysicalFileIfUnreferencedWithLock(file);

        verify(storageService).deleteFile("object-key");
        verify(redis, org.mockito.Mockito.times(2)).execute(any(), any(), any());
    }

    private FileInfo file(String id, String storageSettingId, String objectKey) {
        FileInfo file = new FileInfo();
        file.setId(id);
        file.setStoragePlatformSettingId(storageSettingId);
        file.setObjectKey(objectKey);
        file.setContentMd5("md5");
        file.setSize(1024L);
        file.setIsDir(false);
        return file;
    }
}
