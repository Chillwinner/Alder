/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImGroupVO {
    private String id;
    private String name;
    private String avatar;
    private String ownerId;
    private String notice;
    private String conversationId;
    private Integer memberCount;
    private LocalDateTime createdAt;
}
