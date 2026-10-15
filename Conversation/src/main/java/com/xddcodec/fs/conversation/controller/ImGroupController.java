/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.conversation.domain.dto.CreateGroupCmd;
import com.xddcodec.fs.conversation.domain.dto.InviteGroupMembersCmd;
import com.xddcodec.fs.conversation.domain.dto.UpdateGroupCmd;
import com.xddcodec.fs.conversation.domain.vo.ImGroupMemberVO;
import com.xddcodec.fs.conversation.domain.vo.ImGroupVO;
import com.xddcodec.fs.conversation.service.ImGroupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/conversation/groups")
@Tag(name = "IM 群聊")
public class ImGroupController {

    private final ImGroupService imGroupService;

    @GetMapping
    @Operation(summary = "我的群列表")
    public Result<List<ImGroupVO>> listGroups() {
        return Result.ok(imGroupService.listMyGroups(UserContext.getUserId()));
    }

    @PostMapping
    @Operation(summary = "创建群聊")
    public Result<ImGroupVO> create(@Valid @RequestBody CreateGroupCmd cmd) {
        return Result.ok(imGroupService.createGroup(UserContext.getUserId(), cmd));
    }

    @PutMapping
    @Operation(summary = "修改群头像和简介（群成员均可改）")
    public Result<ImGroupVO> update(@Valid @RequestBody UpdateGroupCmd cmd) {
        return Result.ok(imGroupService.updateGroup(UserContext.getUserId(), cmd));
    }

    @GetMapping("/members")
    @Operation(summary = "群成员列表")
    public Result<List<ImGroupMemberVO>> members(@RequestParam String groupId) {
        return Result.ok(imGroupService.listMembers(UserContext.getUserId(), groupId));
    }

    @PostMapping("/leave")
    @Operation(summary = "退出群聊")
    public Result<Void> leave(@RequestParam String groupId) {
        imGroupService.leaveGroup(UserContext.getUserId(), groupId);
        return Result.ok();
    }

    @PostMapping("/invite")
    @Operation(summary = "邀请好友进群")
    public Result<java.util.Map<String, Integer>> invite(@Valid @RequestBody InviteGroupMembersCmd cmd) {
        int count = imGroupService.inviteMembers(UserContext.getUserId(), cmd);
        return Result.ok(java.util.Map.of("count", count));
    }
}
