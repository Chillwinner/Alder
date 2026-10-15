/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImConversation {
    private String id;
    private String convType;
    private String groupId;
    private String userAId;
    private String userBId;
    private LocalDateTime createdAt;
}
