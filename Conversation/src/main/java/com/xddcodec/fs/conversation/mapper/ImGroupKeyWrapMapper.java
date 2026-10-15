/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImGroupKeyWrap;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImGroupKeyWrapMapper {

    ImGroupKeyWrap selectForMember(@Param("groupId") String groupId, @Param("userId") String userId);

    List<ImGroupKeyWrap> selectByGroup(@Param("groupId") String groupId);

    int upsert(ImGroupKeyWrap row);

    int deleteByGroup(@Param("groupId") String groupId);
}
