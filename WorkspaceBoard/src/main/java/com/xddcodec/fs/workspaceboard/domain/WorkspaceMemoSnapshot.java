/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WorkspaceMemoSnapshot {
    private Long id;
    private String memoId;
    private byte[] yjsState;
    private String contentHash;
    private String commitMessage;
    private LocalDateTime savedAt;
}
