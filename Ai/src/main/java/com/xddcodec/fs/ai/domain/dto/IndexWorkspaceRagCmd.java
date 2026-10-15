/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class IndexWorkspaceRagCmd {

    private List<String> fileIds;
}