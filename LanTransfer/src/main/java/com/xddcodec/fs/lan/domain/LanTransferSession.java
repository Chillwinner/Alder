/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class LanTransferSession {
    private String id;
    private String fromUserId;
    private String toUserId;
    private String filesJson;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
