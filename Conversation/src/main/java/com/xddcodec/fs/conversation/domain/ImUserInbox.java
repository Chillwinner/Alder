/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImUserInbox {
    private String userId;
    private String conversationId;
    private Integer unreadCount;
    private Long lastReadMessageId;
    private Long lastMessageId;
    private String lastContent;
    private LocalDateTime lastTime;
    private Boolean pinned;
    private Boolean muted;
    private LocalDateTime updatedAt;
}
