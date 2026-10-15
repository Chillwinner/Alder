/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import com.xddcodec.fs.File.domain.FileCollection;
import com.xddcodec.fs.File.domain.FileCollectionSubmission;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FileCollectionUploadContext {
    private FileCollection collection;
    private FileCollectionSubmission submission;
}
