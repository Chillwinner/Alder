/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.mapper;

import com.xddcodec.fs.meeting.domain.WorkspaceMeetingRow;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WorkspaceMeetingMapper {

    int insertMeeting(WorkspaceMeetingRow row);

    int insertParticipants(@Param("meetingId") String meetingId, @Param("userIds") List<String> userIds);

    List<WorkspaceMeetingRow> selectByWorkspace(@Param("workspaceId") String workspaceId);

    List<String> selectParticipantIds(@Param("meetingId") String meetingId);

    List<WorkspaceMeetingRow> selectUpcomingForUser(@Param("userId") String userId);

    WorkspaceMeetingRow selectById(@Param("id") String id);

    WorkspaceMeetingRow selectByRoomId(@Param("roomId") String roomId);

    int countParticipant(@Param("meetingId") String meetingId, @Param("userId") String userId);

    int markInvitePushed(@Param("id") String id);

    int markPre15Pushed(@Param("id") String id);

    int markOpened(@Param("id") String id);

    int markClosed(@Param("id") String id, @Param("userId") String userId);

    List<WorkspaceMeetingRow> selectDuePre15();
}
