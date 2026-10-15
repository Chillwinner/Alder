/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.vo.ImUserSearchVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImUserSearchMapper {

    List<ImUserSearchVO> search(@Param("userId") String userId, @Param("keyword") String keyword);
}
