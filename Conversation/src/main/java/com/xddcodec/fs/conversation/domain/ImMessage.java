/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImMessage {
    private Long id;
    private String clientMsgId;
    private String conversationId;
    private String senderId;
    private String content;
    private String msgType;
    private LocalDateTime createdAt;
    private LocalDateTime recalledAt;
    private Long quoteMessageId;
}
