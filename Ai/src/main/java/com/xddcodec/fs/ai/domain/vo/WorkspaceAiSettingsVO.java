/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.vo;

import lombok.Data;

@Data
public class WorkspaceAiSettingsVO {
    private Boolean enabled;
    private String baseUrl;
    private String modelName;
    private String customPrompt;
    private Boolean apiKeyConfigured;
    private String apiKeyMasked;
    private Boolean usingWorkspaceKey;
    private Boolean canEdit;
}
