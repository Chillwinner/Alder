/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ImFromWorkspaceFileCmd {
    @NotBlank
    private String conversationId;
    @NotBlank
    private String fileId;
}
