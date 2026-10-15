/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImGroupMember;
import com.xddcodec.fs.conversation.domain.vo.ImGroupMemberVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImGroupMemberMapper {

    ImGroupMember selectMember(@Param("groupId") String groupId, @Param("userId") String userId);

    List<ImGroupMember> listByGroupId(@Param("groupId") String groupId);

    List<ImGroupMemberVO> listMembers(@Param("groupId") String groupId,
                                      @Param("viewerUserId") String viewerUserId);

    List<String> listUserIds(@Param("groupId") String groupId);

    int countByGroupId(@Param("groupId") String groupId);

    int insert(ImGroupMember row);

    int deleteMember(@Param("groupId") String groupId, @Param("userId") String userId);

    int updateRole(@Param("groupId") String groupId,
                   @Param("userId") String userId,
                   @Param("role") String role);
}
