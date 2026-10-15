/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.dto;

import lombok.Data;

@Data
public class UpdateWorkspaceAiSettingsCmd {
    private Boolean enabled;
    private String baseUrl;
    private String modelName;
    private String apiKey;
    private Boolean clearApiKey;
    private String customPrompt;
}
