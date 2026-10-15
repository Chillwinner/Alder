/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.mapper;

import com.xddcodec.fs.lan.domain.LanTransferSession;
import org.apache.ibatis.annotations.Param;

public interface LanTransferSessionMapper {

    int insert(LanTransferSession session);

    LanTransferSession selectById(@Param("id") String id);

    int updateStatus(@Param("id") String id, @Param("status") String status);
}
