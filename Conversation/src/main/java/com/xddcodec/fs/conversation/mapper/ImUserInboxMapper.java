/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImMessage;
import com.xddcodec.fs.conversation.domain.ImUserInbox;
import com.xddcodec.fs.conversation.domain.vo.ImInboxVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImUserInboxMapper {

    ImUserInbox selectPair(@Param("userId") String userId, @Param("conversationId") String conversationId);

    Long selectLastReadMessageId(@Param("userId") String userId, @Param("conversationId") String conversationId);

    List<ImInboxVO> listInbox(@Param("userId") String userId);

    Integer sumUnread(@Param("userId") String userId);

    int ensureInbox(@Param("userId") String userId, @Param("conversationId") String conversationId);

    int bumpUnread(@Param("userId") String userId,
                   @Param("conversationId") String conversationId,
                   @Param("message") ImMessage message,
                   @Param("preview") String preview);

    int markRead(@Param("userId") String userId,
                 @Param("conversationId") String conversationId,
                 @Param("lastId") Long lastId);

    int touchPreview(@Param("userId") String userId,
                     @Param("conversationId") String conversationId,
                     @Param("message") ImMessage message,
                     @Param("preview") String preview);

    int replacePreviewIfLastMessage(@Param("conversationId") String conversationId,
                                    @Param("messageId") Long messageId,
                                    @Param("preview") String preview);

    int updateMuted(@Param("userId") String userId,
                    @Param("conversationId") String conversationId,
                    @Param("muted") boolean muted);

    int deleteInbox(@Param("userId") String userId, @Param("conversationId") String conversationId);

    int deleteByConversation(@Param("conversationId") String conversationId);
}
