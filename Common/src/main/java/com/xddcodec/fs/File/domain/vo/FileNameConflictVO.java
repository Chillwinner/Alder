/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;

@Data
public class FileNameConflictVO {

    private String fileName;

    private Boolean conflict;

    private String suggestedName;
}
