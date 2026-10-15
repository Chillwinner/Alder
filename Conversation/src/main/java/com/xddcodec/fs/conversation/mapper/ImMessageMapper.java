/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImMessage;
import com.xddcodec.fs.conversation.domain.vo.ImMessageVO;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ImMessageMapper {

    ImMessage selectByClientMsg(@Param("conversationId") String conversationId,
                                @Param("senderId") String senderId,
                                @Param("clientMsgId") String clientMsgId);

    ImMessage selectById(@Param("id") Long id);

    List<ImMessage> listAfter(@Param("conversationId") String conversationId,
                              @Param("afterId") Long afterId,
                              @Param("limit") int limit);

    List<ImMessageVO> listAfterVo(@Param("conversationId") String conversationId,
                                  @Param("userId") String userId,
                                  @Param("afterId") Long afterId,
                                  @Param("limit") int limit);

    List<ImMessageVO> listLatestVo(@Param("conversationId") String conversationId,
                                   @Param("userId") String userId,
                                   @Param("limit") int limit);

    List<ImMessageVO> listBeforeVo(@Param("conversationId") String conversationId,
                                   @Param("userId") String userId,
                                   @Param("beforeId") Long beforeId,
                                   @Param("limit") int limit);

    ImMessageVO selectLatestVisibleVo(@Param("conversationId") String conversationId,
                                      @Param("userId") String userId);

    int hideForUser(@Param("userId") String userId,
                    @Param("messageId") Long messageId,
                    @Param("conversationId") String conversationId);

    ImMessageVO selectVoById(@Param("id") Long id);

    int insert(ImMessage row);

    int markRecalled(@Param("id") Long id, @Param("recalledAt") LocalDateTime recalledAt);
}
