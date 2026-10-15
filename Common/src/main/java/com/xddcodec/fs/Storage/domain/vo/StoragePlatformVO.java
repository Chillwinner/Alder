/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Storage.domain.vo;

import com.xddcodec.fs.Storage.domain.StoragePlatform;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
@AutoMapper(target = StoragePlatform.class)
public class StoragePlatformVO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;
    private String name;
    private String identifier;
    private String configScheme;
    private String icon;
    private String link;
    private String desc;
    private Integer isDefault;
}
