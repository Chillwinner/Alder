/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImFriend;
import com.xddcodec.fs.conversation.domain.vo.ImFriendVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImFriendMapper {

    ImFriend selectPair(@Param("userId") String userId, @Param("friendId") String friendId);

    List<ImFriendVO> listFriends(@Param("userId") String userId, @Param("status") String status);

    List<ImFriendVO> listIncomingRequests(@Param("userId") String userId);

    List<ImFriendVO> listRejectedRequests(@Param("userId") String userId);

    int insert(ImFriend row);

    int updateStatus(@Param("userId") String userId,
                     @Param("friendId") String friendId,
                     @Param("status") String status);

    int deletePair(@Param("userId") String userId, @Param("friendId") String friendId);
}
