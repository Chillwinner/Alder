/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.qry;

import lombok.Data;

@Data
public class TransferFilesQry {

    /**
     * 查询状态类型1：上传 2：下载 3：已完成
     */
    private Integer statusType;
}
