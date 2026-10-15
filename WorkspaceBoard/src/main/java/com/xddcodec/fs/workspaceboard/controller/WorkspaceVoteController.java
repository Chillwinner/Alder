/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.workspaceboard.domain.dto.CastWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceVoteVO;
import com.xddcodec.fs.workspaceboard.service.WorkspaceVoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/workspace-votes")
@Tag(name = "工作空间投票")
public class WorkspaceVoteController {

    private final WorkspaceVoteService voteService;

    @GetMapping
    @Operation(summary = "当前工作空间的投票")
    public Result<List<WorkspaceVoteVO>> list() {
        return Result.ok(voteService.listCurrentWorkspace());
    }

    @GetMapping("/pending")
    @Operation(summary = "当前用户尚未表态的投票")
    public Result<List<WorkspaceVoteVO>> pending() {
        return Result.ok(voteService.listPendingForCurrentUser());
    }

    @PostMapping
    @Operation(summary = "发起投票")
    public Result<WorkspaceVoteVO> create(@RequestBody CreateWorkspaceVoteCmd cmd) {
        return Result.ok(voteService.create(cmd));
    }

    @PostMapping("/{voteId}/choice")
    @Operation(summary = "同意或不同意")
    public Result<Void> cast(@PathVariable String voteId, @RequestBody CastWorkspaceVoteCmd cmd) {
        voteService.cast(voteId, cmd);
        return Result.ok();
    }
}
