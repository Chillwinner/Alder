/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.lan.domain.dto.CreateLanSessionCmd;
import com.xddcodec.fs.lan.domain.dto.LanSignalCmd;
import com.xddcodec.fs.lan.domain.vo.LanSessionVO;
import com.xddcodec.fs.lan.service.LanTransferService;
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
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/lan")
@Tag(name = "局域网互传")
public class LanTransferController {

    private final LanTransferService lanTransferService;

    @PostMapping("/presence")
    @Operation(summary = "上报在线")
    public Result<Void> presence() {
        lanTransferService.heartbeat(UserContext.getUserId());
        return Result.ok();
    }

    @GetMapping("/online")
    @Operation(summary = "查询哪些人在线")
    public Result<Map<String, Boolean>> online(@RequestParam List<String> userIds) {
        return Result.ok(lanTransferService.onlineMap(userIds));
    }

    @PostMapping("/sessions")
    @Operation(summary = "发起互传")
    public Result<LanSessionVO> create(@RequestBody CreateLanSessionCmd cmd) {
        return Result.ok(lanTransferService.create(UserContext.getUserId(), cmd));
    }

    @GetMapping("/sessions/{sessionId}")
    @Operation(summary = "会话详情")
    public Result<LanSessionVO> detail(@PathVariable String sessionId) {
        return Result.ok(lanTransferService.get(UserContext.getUserId(), sessionId));
    }

    @PostMapping("/sessions/{sessionId}/accept")
    public Result<LanSessionVO> accept(@PathVariable String sessionId) {
        return Result.ok(lanTransferService.accept(UserContext.getUserId(), sessionId));
    }

    @PostMapping("/sessions/{sessionId}/reject")
    public Result<Void> reject(@PathVariable String sessionId) {
        lanTransferService.reject(UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public Result<Void> cancel(@PathVariable String sessionId) {
        lanTransferService.cancel(UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/fail")
    public Result<Void> fail(@PathVariable String sessionId) {
        lanTransferService.fail(UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/done")
    public Result<Void> done(@PathVariable String sessionId) {
        lanTransferService.done(UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @PostMapping("/sessions/{sessionId}/signal")
    @Operation(summary = "转发 WebRTC 信令")
    public Result<Void> signal(@PathVariable String sessionId, @RequestBody LanSignalCmd cmd) {
        lanTransferService.signal(UserContext.getUserId(), sessionId, cmd);
        return Result.ok();
    }
}
