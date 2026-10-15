/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MemoSyncPayload {
    @NotBlank
    private String memoId;
    /**
     * UPDATE | SNAPSHOT | AWARENESS
     */
    @NotBlank
    private String type;
    @NotBlank
    private String payloadBase64;
}
