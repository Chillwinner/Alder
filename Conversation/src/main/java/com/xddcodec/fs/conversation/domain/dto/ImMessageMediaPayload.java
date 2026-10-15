/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class ImMessageMediaPayload {
    private String url;
    private String name;
    private Long size;
    private String mime;
    private Integer width;
    private Integer height;
    private String shareId;
    private String fileId;
    @JsonProperty("isDir")
    private Boolean dir;
}
