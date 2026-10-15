/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.vo;

import lombok.Data;

@Data
public class WorkspaceAiRagFileVO {

    private String fileId;
    private String displayName;
    private Long size;
    private boolean indexed;
    private Integer chunkCount;
}