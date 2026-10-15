/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImFriendVO {
    private String friendId;
    private String username;
    private String nickname;
    private String avatar;
    /** 好友账号邮箱（工作空间邮件邀请等场景使用） */
    private String email;
    private String remark;
    private String status;
    private LocalDateTime createdAt;
}
