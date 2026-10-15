/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import lombok.Data;

@Data
public class ImGroupKeyWrapVO {
    private String groupId;
    private Integer keyVersion;
    private String wrappedKey;
}
