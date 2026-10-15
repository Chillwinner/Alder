/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户收藏文件实体类
 *
 * @Author: xddcode
 * @Date: 2025/5/12 13:47
 */
@Data
public class FileUserFavorites implements Serializable {

    @Serial
    private static final long serialVersionUID = 4725335083497380636L;

    private String workspaceId;

    private String userId;

    private String fileId;

    private LocalDateTime favoriteTime;
}
