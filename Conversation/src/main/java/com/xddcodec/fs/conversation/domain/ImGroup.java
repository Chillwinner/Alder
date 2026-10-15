/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ImGroup {
    private String id;
    private String name;
    private String avatar;
    private String ownerId;
    private String notice;
    private Integer maxMembers;
    private LocalDateTime createdAt;
    private LocalDateTime dissolvedAt;
}
