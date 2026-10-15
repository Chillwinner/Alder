/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class ImGroupKeyWrapCmd {
    private Integer keyVersion;
    private List<MemberWrap> wraps;

    @Data
    public static class MemberWrap {
        private String userId;
        private String wrappedKey;
    }
}
