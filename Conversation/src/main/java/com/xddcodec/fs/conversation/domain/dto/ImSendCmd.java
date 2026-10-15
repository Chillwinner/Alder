/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ImSendCmd {
    private String conversationId;
    private String friendId;
    @NotBlank
    private String clientMsgId;
    private String msgType;
    @NotBlank
    @Size(max = 4096)
    private String content;
    private Long quoteMessageId;
}
