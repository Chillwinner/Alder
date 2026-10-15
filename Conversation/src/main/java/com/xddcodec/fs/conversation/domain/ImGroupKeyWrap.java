/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImGroupKeyWrap {
    private String groupId;
    private String userId;
    private Integer keyVersion;
    private String wrappedKey;
    private LocalDateTime updatedAt;
}
