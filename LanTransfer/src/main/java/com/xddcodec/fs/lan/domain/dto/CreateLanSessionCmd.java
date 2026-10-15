/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateLanSessionCmd {
    private String toUserId;
    private List<LanFileItem> files;
}
