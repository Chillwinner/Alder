/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Log.domain.dto;

import com.xddcodec.fs.Framework.common.domain.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 登录日志分页查询对象
 *
 * @Author: xddcodec
 * @Date: 2025/9/25 16:06
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class LoginLogPageQry extends PageQuery {

    private String keyword;

    private Integer status;
}
