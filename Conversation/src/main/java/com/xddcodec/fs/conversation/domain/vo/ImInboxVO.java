/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImInboxVO {
    private String conversationId;
    private String convType;
    private String groupId;
    private String groupName;
    private String peerUserId;
    private String peerUsername;
    private String peerNickname;
    private String peerAvatar;
    private String groupAvatar;
    private String groupNotice;
    private Integer unreadCount;
    private Long lastMessageId;
    private String lastContent;
    private LocalDateTime lastTime;
    private Boolean pinned;
    private Boolean muted;
}
