/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImMessageVO {
    private Long id;
    private String clientMsgId;
    private String conversationId;
    private String senderId;
    private String senderUsername;
    private String senderNickname;
    private String senderAvatar;
    private String content;
    private String msgType;
    private LocalDateTime createdAt;
    private LocalDateTime recalledAt;
    private Long quoteMessageId;
    private String quoteSenderId;
    private String quoteSenderName;
    private String quoteContent;
    private String quoteMsgType;
    private Boolean quoteRecalled;
}
