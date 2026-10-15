/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.FileCollection;
import com.xddcodec.fs.File.domain.dto.CreateFileCollectionCmd;
import com.xddcodec.fs.File.domain.dto.CreateFileCollectionSubmissionCmd;
import com.xddcodec.fs.File.domain.qry.FileCollectionQry;
import com.xddcodec.fs.File.domain.qry.FileCollectionSubmissionQry;
import com.xddcodec.fs.File.domain.vo.FileCollectionPublicVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionSubmissionSessionVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionSubmissionVO;
import com.xddcodec.fs.File.domain.vo.FileCollectionUploadContext;
import com.xddcodec.fs.File.domain.vo.FileCollectionDeletionResult;
import com.xddcodec.fs.File.domain.vo.FileCollectionVO;
import com.xddcodec.fs.File.enums.FileCollectionStatus;
import com.xddcodec.fs.Framework.common.domain.PageResult;

public interface FileCollectionService {
    PageResult<FileCollectionVO> getPages(FileCollectionQry qry);

    java.util.List<FileCollectionVO> listAssignedToMe();
    FileCollectionVO getDetail(String collectionId);
    FileCollectionVO createCollection(CreateFileCollectionCmd cmd);
    FileCollectionVO updateStatus(String collectionId, FileCollectionStatus status);
    FileCollectionDeletionResult deleteCollection(String collectionId);
    PageResult<FileCollectionSubmissionVO> getSubmissions(String collectionId, FileCollectionSubmissionQry qry);
    FileCollectionPublicVO getPublicInfo(String collectionId);
    FileCollectionSubmissionSessionVO startSubmission(String collectionId, CreateFileCollectionSubmissionCmd cmd);
    void completeSubmission(String collectionId, String submissionId, String uploadToken);
    FileCollectionUploadContext authorizeUpload(String collectionId, String submissionId, String uploadToken);
    void recordUploadedFile(String collectionId, String submissionId, long fileSize);
}
