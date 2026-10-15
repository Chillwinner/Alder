/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.conversation.domain.dto.ImReadCmd;
import com.xddcodec.fs.conversation.domain.dto.ImMessageIdCmd;
import com.xddcodec.fs.conversation.domain.dto.ImMuteCmd;
import com.xddcodec.fs.conversation.domain.dto.ImSendCmd;
import com.xddcodec.fs.conversation.domain.vo.ImHistoryVO;
import com.xddcodec.fs.conversation.domain.vo.ImInboxVO;
import com.xddcodec.fs.conversation.domain.vo.ImMessageVO;
import com.xddcodec.fs.conversation.service.ConversationService;
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
import java.util.Map;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/conversation")
@Tag(name = "IM 会话")
public class ConversationController {

    private final ConversationService conversationService;

    @GetMapping("/inbox")
    @Operation(summary = "会话列表")
    public Result<List<ImInboxVO>> inbox() {
        return Result.ok(conversationService.inbox(requireUserId()));
    }

    @GetMapping("/unread")
    @Operation(summary = "未读总数")
    public Result<Map<String, Integer>> unread() {
        return Result.ok(Map.of("total", conversationService.unreadTotal(requireUserId())));
    }

    @GetMapping("/history")
    @Operation(summary = "历史消息（afterId 之后 / beforeId 之前）")
    public Result<ImHistoryVO> history(@RequestParam String conversationId,
                                       @RequestParam(required = false, defaultValue = "0") Long afterId,
                                       @RequestParam(required = false, defaultValue = "0") Long beforeId,
                                       @RequestParam(required = false, defaultValue = "50") Integer limit) {
        return Result.ok(conversationService.history(requireUserId(), conversationId, afterId, beforeId, limit));
    }

    @PostMapping("/send")
    @Operation(summary = "发送消息")
    public Result<ImMessageVO> send(@Valid @RequestBody ImSendCmd cmd) {
        return Result.ok(conversationService.send(requireUserId(), cmd));
    }

    @PostMapping("/recall")
    @Operation(summary = "撤回消息")
    public Result<ImMessageVO> recall(@Valid @RequestBody ImMessageIdCmd cmd) {
        return Result.ok(conversationService.recall(requireUserId(), cmd));
    }

    @PostMapping("/hide")
    @Operation(summary = "删除消息（仅自己不可见）")
    public Result<Void> hide(@Valid @RequestBody ImMessageIdCmd cmd) {
        conversationService.hide(requireUserId(), cmd);
        return Result.ok();
    }

    @PostMapping("/read")
    @Operation(summary = "标记已读")
    public Result<Map<String, Integer>> read(@Valid @RequestBody ImReadCmd cmd) {
        int total = conversationService.markRead(requireUserId(), cmd);
        return Result.ok(Map.of("total", total));
    }

    @PostMapping("/mute")
    @Operation(summary = "会话勿扰")
    public Result<Void> mute(@Valid @RequestBody ImMuteCmd cmd) {
        conversationService.setMuted(requireUserId(), cmd);
        return Result.ok();
    }

    @PostMapping("/single/open")
    @Operation(summary = "打开单聊会话（好友）")
    public Result<Map<String, String>> openSingle(@RequestParam String friendId) {
        String conversationId = conversationService.getOrCreateSingleConversation(requireUserId(), friendId).getId();
        return Result.ok(Map.of("conversationId", conversationId));
    }

    private String requireUserId() {
        return UserContext.getUserId();
    }
}
