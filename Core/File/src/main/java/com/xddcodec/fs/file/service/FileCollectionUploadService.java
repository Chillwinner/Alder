/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CheckUploadCmd;
import com.xddcodec.fs.File.domain.dto.InitUploadCmd;
import com.xddcodec.fs.File.domain.vo.CheckUploadResultVO;
import org.springframework.web.multipart.MultipartFile;

import java.util.Set;

public interface FileCollectionUploadService {
    String initUpload(String collectionId, String submissionId, String uploadToken, InitUploadCmd cmd);
    CheckUploadResultVO checkUpload(String collectionId, String submissionId, String uploadToken, CheckUploadCmd cmd);
    void uploadChunk(String collectionId, String submissionId, String uploadToken,
                     String taskId, Integer chunkIndex, String chunkMd5, MultipartFile file);
    Set<Integer> getUploadedChunks(String collectionId, String submissionId, String uploadToken, String taskId);
    FileInfo mergeChunks(String collectionId, String submissionId, String uploadToken, String taskId);
}
