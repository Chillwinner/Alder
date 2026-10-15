/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.util.List;

@Data
public class ImHistoryVO {
    private List<ImMessageVO> messages;
    /** 单聊时对方已读到的最新消息 ID */
    private Long peerLastReadMessageId;
}
