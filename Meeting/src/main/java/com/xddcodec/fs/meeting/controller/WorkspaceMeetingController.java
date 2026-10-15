/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.meeting.domain.dto.CreateWorkspaceMeetingCmd;
import com.xddcodec.fs.meeting.domain.vo.IceConfigVO;
import com.xddcodec.fs.meeting.domain.vo.MeetingJoinVO;
import com.xddcodec.fs.meeting.domain.vo.WorkspaceMeetingVO;
import com.xddcodec.fs.meeting.service.WorkspaceMeetingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/workspace-meetings")
@Tag(name = "工作空间会议")
public class WorkspaceMeetingController {

    private final WorkspaceMeetingService meetingService;

    @GetMapping
    @Operation(summary = "当前工作空间的会议")
    public Result<List<WorkspaceMeetingVO>> list() {
        return Result.ok(meetingService.listCurrentWorkspace());
    }

    @GetMapping("/pending")
    @Operation(summary = "当前用户尚未结束的会议")
    public Result<List<WorkspaceMeetingVO>> pending() {
        return Result.ok(meetingService.listUpcomingForCurrentUser());
    }

    @PostMapping
    @Operation(summary = "预约会议")
    public Result<WorkspaceMeetingVO> create(@RequestBody CreateWorkspaceMeetingCmd cmd) {
        return Result.ok(meetingService.create(cmd));
    }

    @PostMapping("/{meetingId}/invite")
    @Operation(summary = "会议中途邀请同工作空间成员")
    public Result<Void> invite(@PathVariable String meetingId, @RequestBody CreateWorkspaceMeetingCmd cmd) {
        meetingService.inviteMore(meetingId, cmd == null ? null : cmd.getParticipantUserIds());
        return Result.ok();
    }

    @PostMapping("/{meetingId}/close")
    @Operation(summary = "房主结束会议")
    public Result<Void> close(@PathVariable String meetingId) {
        meetingService.close(meetingId);
        return Result.ok();
    }

    @PostMapping("/{meetingId}/join")
    @Operation(summary = "进入会议室（仅受邀）")
    public Result<MeetingJoinVO> join(@PathVariable String meetingId) {
        return Result.ok(meetingService.join(meetingId));
    }

    @GetMapping("/{meetingId}/ice-servers")
    @Operation(summary = "ICE / TURN 配置")
    public Result<IceConfigVO> ice(@PathVariable String meetingId,
                                   @RequestParam(required = false) String identity) {
        return Result.ok(meetingService.iceServers(meetingId, identity));
    }
}
