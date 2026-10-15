/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImGroupMemberVO {
    private String userId;
    private String username;
    private String nickname;
    private String avatar;
    private String role;
    private String groupNickname;
    private LocalDateTime joinedAt;
    private String friendStatus;
}
