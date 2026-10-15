/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.conversation.domain.dto.ImFriendCmd;
import com.xddcodec.fs.conversation.domain.vo.ImFriendVO;
import com.xddcodec.fs.conversation.domain.vo.ImUserSearchVO;
import com.xddcodec.fs.conversation.service.ImFriendService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/conversation/friends")
@Tag(name = "IM 好友")
public class ImFriendController {

    private final ImFriendService imFriendService;

    @GetMapping
    @Operation(summary = "好友列表")
    public Result<List<ImFriendVO>> listFriends() {
        return Result.ok(imFriendService.listFriends(UserContext.getUserId()));
    }

    @GetMapping("/requests")
    @Operation(summary = "收到的好友申请")
    public Result<List<ImFriendVO>> listRequests() {
        return Result.ok(imFriendService.listIncomingRequests(UserContext.getUserId()));
    }

    @GetMapping("/rejected")
    @Operation(summary = "已拒绝的好友申请")
    public Result<List<ImFriendVO>> listRejected() {
        return Result.ok(imFriendService.listRejectedRequests(UserContext.getUserId()));
    }

    @GetMapping("/search")
    @Operation(summary = "按用户名或邮箱搜索用户")
    public Result<List<ImUserSearchVO>> search(@RequestParam String keyword) {
        return Result.ok(imFriendService.searchUsers(UserContext.getUserId(), keyword));
    }

    @PostMapping("/request")
    @Operation(summary = "发起好友申请")
    public Result<Void> request(@Valid @RequestBody ImFriendCmd cmd) {
        imFriendService.requestFriend(UserContext.getUserId(), cmd);
        return Result.ok();
    }

    @PostMapping("/accept")
    @Operation(summary = "接受好友申请")
    public Result<Void> accept(@RequestParam String friendId) {
        imFriendService.acceptFriend(UserContext.getUserId(), friendId);
        return Result.ok();
    }

    @PostMapping("/reject")
    @Operation(summary = "拒绝好友申请")
    public Result<Void> reject(@RequestParam String friendId) {
        imFriendService.rejectFriend(UserContext.getUserId(), friendId);
        return Result.ok();
    }

    @PostMapping("/block")
    @Operation(summary = "拉黑好友")
    public Result<Void> block(@RequestParam String friendId) {
        imFriendService.blockFriend(UserContext.getUserId(), friendId);
        return Result.ok();
    }

    @PostMapping("/delete")
    @Operation(summary = "删除好友")
    public Result<Void> delete(@RequestParam String friendId) {
        imFriendService.deleteFriend(UserContext.getUserId(), friendId);
        return Result.ok();
    }
}
