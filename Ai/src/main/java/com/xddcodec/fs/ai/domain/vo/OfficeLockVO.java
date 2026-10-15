/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.vo;

import lombok.Data;

@Data
public class OfficeLockVO {
    private String fileId;
    private String displayName;
    private String suffix;
    private String sessionId;
    private boolean lockedByMe;
    private String holderUserId;
    private long revision;
    private boolean officeCliReady;
    private String threadId;
}
