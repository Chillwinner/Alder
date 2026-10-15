/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;
import com.xddcodec.fs.push.RealtimeUserPushPublisher;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.meeting.domain.WorkspaceMeetingRow;
import com.xddcodec.fs.meeting.domain.dto.CreateWorkspaceMeetingCmd;
import com.xddcodec.fs.meeting.domain.vo.IceConfigVO;
import com.xddcodec.fs.meeting.domain.vo.MeetingJoinVO;
import com.xddcodec.fs.meeting.domain.vo.WorkspaceMeetingVO;
import com.xddcodec.fs.meeting.mapper.WorkspaceMeetingMapper;
import com.xddcodec.fs.meeting.wb.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceMeetingService {

    private static final long OPEN_BEFORE_MINUTES = 15;
    private static final String SCHEDULED = "SCHEDULED";
    private static final String OPEN = "OPEN";

    private final WorkspaceMeetingMapper meetingMapper;
    private final SysWorkspaceMemberMapper memberMapper;
    private final RealtimeUserPushPublisher realtimeUserPushPublisher;
    private final RoomService roomService;
    private final TurnCredentialService turnCredentialService;

    public List<WorkspaceMeetingVO> listCurrentWorkspace() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        return meetingMapper.selectByWorkspace(workspaceId).stream()
                .map(row -> toView(row, meetingMapper.selectParticipantIds(row.getId())))
                .toList();
    }

    public List<WorkspaceMeetingVO> listUpcomingForCurrentUser() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        return meetingMapper.selectUpcomingForUser(userId).stream()
                .map(row -> toView(row, List.of()))
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkspaceMeetingVO create(CreateWorkspaceMeetingCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String title = StringUtils.trimToEmpty(cmd == null ? null : cmd.getTitle());
        if (title.isEmpty() || title.length() > 200) {
            throw new BusinessException("meeting.title.invalid");
        }
        OffsetDateTime startsAt = parseStartsAt(cmd == null ? null : cmd.getStartsAt());
        List<String> participantIds = normalizeParticipants(cmd.getParticipantUserIds());
        if (!participantIds.contains(userId)) {
            participantIds.add(0, userId);
        }
        Set<String> members = memberMapper.selectMembers(workspaceId, null).stream()
                .map(WorkspaceMemberVO::getUserId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toSet());
        if (!participantIds.stream().allMatch(members::contains)) {
            throw new BusinessException("meeting.participant.invalid");
        }
        WorkspaceMeetingRow row = new WorkspaceMeetingRow();
        row.setId(IdUtil.fastSimpleUUID());
        row.setWorkspaceId(workspaceId);
        row.setRoomId(IdUtil.fastSimpleUUID());
        row.setTitle(title);
        row.setStartsAt(startsAt);
        row.setCreatedBy(userId);
        meetingMapper.insertMeeting(row);
        meetingMapper.insertParticipants(row.getId(), participantIds);
        row.setStatus(SCHEDULED);
        meetingMapper.markInvitePushed(row.getId());
        boolean openNow = shouldOpen(startsAt);
        push(row, participantIds, RealtimeUserPushPublisher.TYPE_WORKSPACE_MEETING, false);
        if (openNow) {
            openRoom(row, participantIds);
        }
        WorkspaceMeetingRow stored = meetingMapper.selectById(row.getId());
        return toView(stored == null ? row : stored, participantIds);
    }

    @Transactional(rollbackFor = Exception.class)
    public void inviteMore(String meetingId, List<String> rawIds) {
        WorkspaceMeetingRow row = requireParticipantMeeting(meetingId);
        if ("CLOSED".equals(row.getStatus())) {
            throw new BusinessException("meeting.not.open");
        }
        List<String> requested = normalizeParticipants(rawIds);
        Set<String> members = memberMapper.selectMembers(row.getWorkspaceId(), null).stream()
                .map(WorkspaceMemberVO::getUserId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toSet());
        if (!requested.stream().allMatch(members::contains)) {
            throw new BusinessException("meeting.participant.invalid");
        }
        Set<String> existing = new LinkedHashSet<>(meetingMapper.selectParticipantIds(meetingId));
        List<String> fresh = requested.stream().filter(id -> !existing.contains(id)).toList();
        if (fresh.isEmpty()) {
            return;
        }
        meetingMapper.insertParticipants(meetingId, fresh);
        boolean canEnter = OPEN.equals(row.getStatus());
        push(row, fresh, RealtimeUserPushPublisher.TYPE_WORKSPACE_MEETING, canEnter);
    }

    public MeetingJoinVO join(String meetingId) {
        WorkspaceMeetingRow row = requireParticipantMeeting(meetingId);
        assertOpen(row);
        if (!roomService.isRoomActive(row.getRoomId())) {
            roomService.activateForMeeting(row.getRoomId());
        }
        MeetingJoinVO vo = new MeetingJoinVO();
        vo.setMeetingId(row.getId());
        vo.setRoomId(row.getRoomId());
        vo.setTitle(row.getTitle());
        vo.setWorkspaceName(row.getWorkspaceName());
        vo.setHost(UserContext.getUserId().equals(row.getCreatedBy()));
        return vo;
    }

    public void close(String meetingId) {
        String userId = UserContext.getUserId();
        WorkspaceMeetingRow row = meetingMapper.selectById(meetingId);
        if (row == null) {
            throw new BusinessException("meeting.not.found");
        }
        if (!userId.equals(row.getCreatedBy())) {
            throw new BusinessException("meeting.close.forbidden");
        }
        if (!OPEN.equals(row.getStatus())) {
            throw new BusinessException("meeting.not.open");
        }
        if (meetingMapper.markClosed(meetingId, userId) != 1) {
            throw new BusinessException("meeting.not.open");
        }
        roomService.closeRoom(row.getRoomId(), null);
    }

    public IceConfigVO iceServers(String meetingId, String identity) {
        WorkspaceMeetingRow row = requireParticipantMeeting(meetingId);
        assertOpen(row);
        if (!roomService.isRoomActive(row.getRoomId())) {
            roomService.activateForMeeting(row.getRoomId());
        }
        String who = StringUtils.defaultIfBlank(identity, UserContext.getUserId());
        return turnCredentialService.buildIceConfig(who);
    }

    public void assertRoomParticipant(String roomId, String userId) {
        WorkspaceMeetingRow row = meetingMapper.selectByRoomId(roomId);
        if (row == null || meetingMapper.countParticipant(row.getId(), userId) < 1) {
            throw new BusinessException("meeting.not.invited");
        }
        assertOpen(row);
        if (!roomService.isRoomActive(roomId)) {
            roomService.activateForMeeting(roomId);
        }
    }

    public void pushDuePre15() {
        for (WorkspaceMeetingRow row : meetingMapper.selectDuePre15()) {
            List<String> ids = meetingMapper.selectParticipantIds(row.getId());
            WorkspaceMeetingRow full = meetingMapper.selectById(row.getId());
            openRoom(full == null ? row : full, ids);
        }
    }

    private WorkspaceMeetingRow requireParticipantMeeting(String meetingId) {
        String userId = UserContext.getUserId();
        WorkspaceMeetingRow row = meetingMapper.selectById(meetingId);
        if (row == null) {
            throw new BusinessException("meeting.not.found");
        }
        if (meetingMapper.countParticipant(meetingId, userId) < 1) {
            throw new BusinessException("meeting.not.invited");
        }
        return row;
    }

    private void openRoom(WorkspaceMeetingRow row, List<String> participantIds) {
        if (meetingMapper.markOpened(row.getId()) != 1) {
            return;
        }
        boolean notify = meetingMapper.markPre15Pushed(row.getId()) == 1;
        row.setStatus(OPEN);
        roomService.activateForMeeting(row.getRoomId());
        if (notify) {
            push(row, participantIds, RealtimeUserPushPublisher.TYPE_WORKSPACE_MEETING_PRE15, true);
        }
    }

    private void assertOpen(WorkspaceMeetingRow row) {
        if (row == null || !OPEN.equals(row.getStatus())) {
            throw new BusinessException("meeting.not.open");
        }
    }

    private boolean shouldOpen(OffsetDateTime startsAt) {
        if (startsAt == null) {
            return false;
        }
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        return !now.isBefore(startsAt.minusMinutes(OPEN_BEFORE_MINUTES));
    }

    private OffsetDateTime parseStartsAt(String raw) {
        String text = StringUtils.trimToNull(raw);
        if (text == null) {
            throw new BusinessException("meeting.starts.invalid");
        }
        try {
            return OffsetDateTime.parse(text);
        } catch (Exception ex) {
            throw new BusinessException("meeting.starts.invalid");
        }
    }

    private static String formatTime(OffsetDateTime value) {
        return value == null ? null : value.toString();
    }

    private void push(WorkspaceMeetingRow row, List<String> userIds, String type, boolean canEnter) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("meetingId", row.getId());
        extra.put("workspaceId", row.getWorkspaceId());
        extra.put("workspaceSlug", row.getWorkspaceSlug());
        extra.put("workspaceName", row.getWorkspaceName());
        extra.put("title", row.getTitle());
        extra.put("startsAt", formatTime(row.getStartsAt()));
        extra.put("canEnter", canEnter);
        extra.put("status", row.getStatus());
        extra.put("creatorName", row.getCreatorName());
        for (String userId : userIds) {
            realtimeUserPushPublisher.publish(userId, type, extra);
        }
    }

    private WorkspaceMeetingVO toView(WorkspaceMeetingRow row, List<String> participantIds) {
        WorkspaceMeetingVO vo = new WorkspaceMeetingVO();
        vo.setId(row.getId());
        vo.setWorkspaceId(row.getWorkspaceId());
        vo.setWorkspaceName(row.getWorkspaceName());
        vo.setWorkspaceSlug(row.getWorkspaceSlug());
        vo.setRoomId(row.getRoomId());
        vo.setTitle(row.getTitle());
        vo.setStartsAt(formatTime(row.getStartsAt()));
        vo.setCreatedBy(row.getCreatedBy());
        vo.setCreatorName(row.getCreatorName());
        vo.setCreatedAt(formatTime(row.getCreatedAt()));
        vo.setStatus(StringUtils.defaultIfBlank(row.getStatus(), SCHEDULED));
        vo.setCanEnter(OPEN.equals(vo.getStatus()));
        vo.setHost(UserContext.getUserId() != null && UserContext.getUserId().equals(row.getCreatedBy()));
        vo.setParticipantUserIds(participantIds);
        return vo;
    }

    private List<String> normalizeParticipants(List<String> raw) {
        Set<String> ids = new LinkedHashSet<>();
        if (raw != null) {
            for (String id : raw) {
                String trimmed = StringUtils.trimToNull(id);
                if (trimmed != null) {
                    ids.add(trimmed);
                }
            }
        }
        if (ids.isEmpty()) {
            throw new BusinessException("meeting.participants.required");
        }
        return new ArrayList<>(ids);
    }
}
