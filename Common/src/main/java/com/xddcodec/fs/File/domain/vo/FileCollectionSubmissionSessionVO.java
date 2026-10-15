/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FileCollectionSubmissionSessionVO {
    private String submissionId;
    private String uploadToken;
    private String folderName;
}
