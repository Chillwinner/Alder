/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import com.xddcodec.fs.conversation.domain.vo.ImMessageVO;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ImPush {
    private String type;
    private String userId;
    private String conversationId;
    private Integer unreadCount;
    private Long lastReadMessageId;
    private ImMessageVO message;
}
