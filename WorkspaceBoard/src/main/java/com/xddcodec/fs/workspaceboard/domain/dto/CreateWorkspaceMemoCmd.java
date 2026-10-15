/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.dto;

import lombok.Data;

@Data
public class CreateWorkspaceMemoCmd {
    private String title;
    /** shared（空间成员可见可改）或 private（仅创建者）。空或非法时按 private。 */
    private String visibility;
    /** md（默认）或 canvas */
    private String kind;
}
