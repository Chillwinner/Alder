/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class ImMessageMediaUploadVO {
    private String url;
    private String name;
    private Long size;
    private String mime;
    private String shareId;
    private String fileId;
    @JsonProperty("isDir")
    private Boolean dir;
}
