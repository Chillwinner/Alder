/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

import lombok.Data;

@Data
public class FileCollectionAssigneeVO {
    private String userId;
    private String name;
    private boolean submitted;
}
