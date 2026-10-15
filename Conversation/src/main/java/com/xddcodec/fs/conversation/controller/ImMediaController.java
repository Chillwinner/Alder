/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.conversation.domain.dto.ImFromWorkspaceFileCmd;
import com.xddcodec.fs.conversation.domain.dto.ImSaveToWorkspaceCmd;
import com.xddcodec.fs.conversation.domain.vo.ImMessageMediaUploadVO;
import com.xddcodec.fs.conversation.service.ImMediaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/conversation/media")
@Tag(name = "IM 媒体")
public class ImMediaController {

    private final ImMediaService imMediaService;

    @PostMapping("/group-avatar")
    @Operation(summary = "上传群头像")
    public Result<Map<String, String>> uploadGroupAvatar(@RequestParam("file") MultipartFile file) {
        return Result.ok(Map.of("path", imMediaService.uploadGroupAvatar(file)));
    }

    @PostMapping("/message")
    @Operation(summary = "上传聊天附件")
    public Result<ImMessageMediaUploadVO> uploadMessageMedia(
            @RequestParam("conversationId") String conversationId,
            @RequestParam("file") MultipartFile file) {
        return Result.ok(imMediaService.uploadMessageMedia(conversationId, file));
    }

    @PostMapping("/from-file")
    @Operation(summary = "把工作空间文件或文件夹以分享形式发到聊天")
    public Result<ImMessageMediaUploadVO> shareWorkspaceFile(@Valid @RequestBody ImFromWorkspaceFileCmd cmd) {
        return Result.ok(imMediaService.shareWorkspaceFile(cmd.getConversationId(), cmd.getFileId()));
    }

    @PostMapping("/save-to-workspace")
    @Operation(summary = "把聊天文件复制到当前工作空间")
    public Result<FileInfo> saveToWorkspace(@Valid @RequestBody ImSaveToWorkspaceCmd cmd) {
        return Result.ok(imMediaService.saveMessageToWorkspace(
                cmd.getConversationId(), cmd.getMessageId(), cmd.getParentId()));
    }
}
