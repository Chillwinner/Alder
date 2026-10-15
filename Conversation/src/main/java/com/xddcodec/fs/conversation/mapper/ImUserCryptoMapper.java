/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImUserCrypto;
import org.apache.ibatis.annotations.Param;

public interface ImUserCryptoMapper {

    ImUserCrypto selectByUserId(@Param("userId") String userId);

    int upsert(ImUserCrypto row);
}
