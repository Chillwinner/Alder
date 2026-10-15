/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.UpdateFilesharePinCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.UpdateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoBodyVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoCanvasVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoListPreviewVO;
import com.xddcodec.fs.workspaceboard.domain.vo.MemoYjsStateVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceBoardOverviewVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceMemoVO;
import com.xddcodec.fs.workspaceboard.service.WorkspaceMemoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/workspace-board")
@Tag(name = "工作空间协作页")
public class WorkspaceBoardController {

    private final WorkspaceMemoService memoService;

    @GetMapping("/overview")
    @Operation(summary = "协作页概览（备忘录 + fileshare 文件）")
    public Result<WorkspaceBoardOverviewVO> overview() {
        return Result.ok(memoService.overview());
    }

    @PostMapping("/memos")
    @Operation(summary = "新建备忘录")
    public Result<WorkspaceMemoVO> create(@Valid @RequestBody CreateWorkspaceMemoCmd cmd) {
        return Result.ok(memoService.create(cmd));
    }

    @PutMapping("/memos/{memoId}")
    @Operation(summary = "更新备忘录元数据")
    public Result<WorkspaceMemoVO> update(@PathVariable String memoId,
                                        @RequestBody UpdateWorkspaceMemoCmd cmd) {
        return Result.ok(memoService.update(memoId, cmd));
    }

    @DeleteMapping("/memos/{memoId}")
    @Operation(summary = "删除备忘录")
    public Result<Void> delete(@PathVariable String memoId) {
        memoService.delete(memoId);
        return Result.ok();
    }

    @GetMapping("/memos/{memoId}/yjs-state")
    @Operation(summary = "加载备忘录 Yjs 初始状态")
    public Result<MemoYjsStateVO> yjsState(@PathVariable String memoId) {
        return Result.ok(memoService.loadYjsState(memoId));
    }

    @GetMapping("/memos/{memoId}/snapshots")
    @Operation(summary = "备忘录历史版本")
    public Result<List<com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO>> snapshots(
            @PathVariable String memoId) {
        return Result.ok(memoService.listSnapshots(memoId));
    }

    @PostMapping("/memos/{memoId}/snapshots")
    @Operation(summary = "手动提交备忘录版本")
    public Result<com.xddcodec.fs.workspaceboard.domain.vo.MemoSnapshotVO> commitSnapshot(
            @PathVariable String memoId,
            @RequestBody com.xddcodec.fs.workspaceboard.domain.dto.CommitMemoSnapshotCmd cmd) {
        return Result.ok(memoService.commitSnapshot(memoId, cmd == null ? null : cmd.getMessage()));
    }

    @PostMapping("/memos/{memoId}/snapshots/{snapshotId}/restore")
    @Operation(summary = "回滚备忘录到某个历史版本")
    public Result<MemoYjsStateVO> restoreSnapshot(
            @PathVariable String memoId, @PathVariable Long snapshotId) {
        return Result.ok(memoService.restoreSnapshot(memoId, snapshotId));
    }

    @GetMapping("/memos/lookup")
    @Operation(summary = "按标题查找当前用户的备忘录")
    public Result<WorkspaceMemoVO> lookup(@RequestParam String name) {
        return Result.ok(memoService.lookupByTitle(name));
    }

    @GetMapping("/memos/by-file/{fileId}")
    @Operation(summary = "按 fileshare 文件查找备忘录")
    public Result<WorkspaceMemoVO> lookupByFile(@PathVariable String fileId) {
        return Result.ok(memoService.lookupByFileId(fileId));
    }

    @PostMapping("/memos/restore-by-files")
    @Operation(summary = "文件从回收站还原后，恢复对应备忘录")
    public Result<Void> restoreByFiles(@RequestBody List<String> fileIds) {
        memoService.restoreByFileIds(fileIds);
        return Result.ok();
    }

    @GetMapping("/memos/{memoId}/available")
    @Operation(summary = "探测备忘录是否仍可打开（不返回正文）")
    public Result<Void> available(@PathVariable String memoId) {
        memoService.assertAvailable(memoId);
        return Result.ok();
    }

    @GetMapping("/memos/{memoId}/preview")
    @Operation(summary = "备忘录列表短摘要（不含图片正文）")
    public Result<MemoListPreviewVO> preview(@PathVariable String memoId) {
        return Result.ok(memoService.loadListPreview(memoId));
    }

    @GetMapping("/memos/{memoId}/body")
    @Operation(summary = "加载备忘录正文")
    public Result<MemoBodyVO> body(@PathVariable String memoId) {
        return Result.ok(memoService.loadBody(memoId));
    }

    @GetMapping("/memos/{memoId}/preview-body")
    @Operation(summary = "预览正文（图不内嵌，按序号另取）")
    public Result<MemoBodyVO> previewBody(@PathVariable String memoId) {
        return Result.ok(memoService.loadPreviewBody(memoId));
    }

    @GetMapping("/memos/{memoId}/inline-image/{index}")
    @Operation(summary = "预览用内嵌图（从 md 里解出，不改原文件）")
    public ResponseEntity<byte[]> inlineImage(@PathVariable String memoId, @PathVariable int index) {
        var image = memoService.inlineImage(memoId, index);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(image.mime()));
        headers.setCacheControl("private, max-age=60");
        headers.setContentLength(image.bytes().length);
        return ResponseEntity.ok().headers(headers).body(image.bytes());
    }

    @GetMapping("/memos/{memoId}/canvas")
    @Operation(summary = "加载架构图画布")
    public Result<MemoCanvasVO> canvas(@PathVariable String memoId) {
        return Result.ok(memoService.loadCanvas(memoId));
    }

    @PutMapping("/memos/{memoId}/canvas")
    @Operation(summary = "保存架构图画布")
    public Result<MemoCanvasVO> saveCanvas(@PathVariable String memoId, @RequestBody MemoCanvasVO body) {
        return Result.ok(memoService.saveCanvas(memoId, body == null ? null : body.getDocument()));
    }

    @PutMapping("/memos/{memoId}/body")
    @Operation(summary = "保存备忘录正文（整篇提交，后写覆盖）")
    public Result<MemoBodyVO> saveBody(@PathVariable String memoId, @RequestBody MemoBodyVO body) {
        return Result.ok(memoService.saveBody(
                memoId,
                body == null ? null : body.getBodyHtml(),
                body == null ? null : body.getBodyMd()));
    }

    @PutMapping("/fileshare/files/{fileId}/pinned")
    @Operation(summary = "协作页 fileshare 文件置顶/取消")
    public Result<Void> setFilesharePinned(@PathVariable String fileId,
                                           @RequestBody UpdateFilesharePinCmd cmd) {
        memoService.setFilesharePinned(fileId, Boolean.TRUE.equals(cmd.getPinned()));
        return Result.ok();
    }
}
