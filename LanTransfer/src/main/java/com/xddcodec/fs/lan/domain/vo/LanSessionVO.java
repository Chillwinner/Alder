/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.domain.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.xddcodec.fs.lan.domain.dto.LanFileItem;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class LanSessionVO {
    private String id;
    private String fromUserId;
    private String fromName;
    private String toUserId;
    private String toName;
    private List<LanFileItem> files;
    private String status;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
}
