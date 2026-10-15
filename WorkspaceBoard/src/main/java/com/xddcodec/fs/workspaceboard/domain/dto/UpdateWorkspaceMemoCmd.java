/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.dto;

import lombok.Data;

@Data
public class UpdateWorkspaceMemoCmd {
    private String title;
    private Boolean pinned;
    private Integer sortOrder;
    private String bodyHtml;
    private String bodyMd;
    /** 只允许 private → shared。shared → private 会被拒绝。 */
    private String visibility;
}
