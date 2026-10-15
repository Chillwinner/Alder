/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WorkspaceAiSettings {
    private String workspaceId;
    private Boolean enabled;
    private String baseUrl;
    private String modelName;
    private String apiKey;
    private String customPrompt;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
