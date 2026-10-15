/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0.
 */

package com.xddcodec.fs.workspaceboard.domain.vo;

import lombok.Data;

@Data
public class MemoBodyVO {
    private String memoId;
    private String visibility;
    private String bodyHtml;
    private String bodyMd;
}
