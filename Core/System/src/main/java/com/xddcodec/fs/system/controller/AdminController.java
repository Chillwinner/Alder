/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.System.domain.dto.UpdateUserStatusCmd;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/apis/admin")
@RequiredArgsConstructor
@Tag(name = "系统管理")
public class AdminController {

    private final SysWorkspaceMemberService memberService;

    @Operation(summary = "启用或禁用工作空间内的用户")
    @PutMapping("/users/{userId}/status")
    @SaCheckPermission("member:manage")
    public Result<Void> updateUserStatus(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserStatusCmd cmd) {
        memberService.updateMemberUserStatus(
                WorkspaceContext.getWorkspaceId(),
                userId,
                cmd.getStatus(),
                UserContext.getUserId());
        return Result.ok();
    }
}
