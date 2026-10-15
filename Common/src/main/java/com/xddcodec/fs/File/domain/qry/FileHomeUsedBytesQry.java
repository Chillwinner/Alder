/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.qry;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "首页存储增长查询条件")
public class FileHomeUsedBytesQry {

    @Schema(description = "单位，1:KB, 2:MB, 3:GB")
    private Integer unit;

    @Schema(description = "日期类型, 0:近三个月, 1:近30天, 2:近7天")
    private Integer dateType;
}
