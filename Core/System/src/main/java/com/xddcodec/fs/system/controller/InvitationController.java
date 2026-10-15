/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.System.domain.vo.InvitationDetailVO;
import com.xddcodec.fs.system.service.SysWorkspaceInvitationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 邀请控制器（公开接口）
 *
 * @Author: xddcode
 * @Date: 2026/4/14
 */
@Validated
@RestController
@RequestMapping("/apis/invitation")
@RequiredArgsConstructor
@Tag(name = "邀请管理（公开）")
public class InvitationController {

    private final SysWorkspaceInvitationService invitationService;

    @Operation(summary = "验证邀请令牌")
    @GetMapping("/verify/{token}")
    public Result<InvitationDetailVO> verifyInvitation(@PathVariable String token) {
        InvitationDetailVO result = invitationService.verifyInvitation(token);
        return Result.ok(result);
    }

    @Operation(summary = "接受邀请")
    @PostMapping("/accept/{token}")
    public Result<Void> acceptInvitation(@PathVariable String token) {
        String userId = UserContext.getUserId();
        invitationService.acceptInvitation(token, userId);
        return Result.ok();
    }

    @Operation(summary = "我的待处理邀请")
    @GetMapping("/mine")
    public Result<List<InvitationDetailVO>> listMine() {
        String userId = UserContext.getUserId();
        return Result.ok(invitationService.listPendingForCurrentUser(userId));
    }

    @Operation(summary = "拒绝邀请")
    @PostMapping("/reject/{token}")
    public Result<Void> rejectInvitation(@PathVariable String token) {
        String userId = UserContext.getUserId();
        invitationService.rejectInvitation(token, userId);
        return Result.ok();
    }
}
