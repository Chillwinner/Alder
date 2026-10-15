/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.domain.dto;

import lombok.Data;

@Data
public class LanSignalCmd {
    private String type;
    private String payload;
}
