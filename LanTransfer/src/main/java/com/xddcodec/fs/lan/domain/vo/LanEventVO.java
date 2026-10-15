/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.domain.vo;

import lombok.Data;

@Data
public class LanEventVO {
    private String type;
    private String sessionId;
    private String fromUserId;
    private String signalType;
    private String payload;
    private LanSessionVO session;
}
