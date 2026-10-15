/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImConversation;
import org.apache.ibatis.annotations.Param;

public interface ImConversationMapper {

    ImConversation selectById(@Param("id") String id);

    ImConversation selectSingle(@Param("userAId") String userAId, @Param("userBId") String userBId);

    ImConversation selectByGroupId(@Param("groupId") String groupId);

    int insert(ImConversation row);
}
