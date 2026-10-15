/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.progress.domain.dto.CreateProgressTaskCmd;
import com.xddcodec.fs.progress.domain.dto.ReviewProgressCmd;
import com.xddcodec.fs.progress.domain.dto.UpdateProgressStatusCmd;
import com.xddcodec.fs.progress.domain.dto.UpdateProgressTaskCmd;
import com.xddcodec.fs.progress.domain.vo.ProgressMonthVO;
import com.xddcodec.fs.progress.domain.vo.ProgressTaskVO;
import com.xddcodec.fs.progress.service.ProgressService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/progress")
@Tag(name = "工作进度")
public class ProgressController {

    private final ProgressService progressService;

    @GetMapping("/tasks")
    @Operation(summary = "任务列表")
    public Result<List<ProgressTaskVO>> list(
            @RequestParam(required = false, defaultValue = "all") String scope,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String date) {
        return Result.ok(progressService.list(scope, kind, status, keyword, date));
    }

    @GetMapping("/month")
    public Result<ProgressMonthVO> month(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        return Result.ok(progressService.month(year, month));
    }

    @GetMapping("/tasks/{id}")
    public Result<ProgressTaskVO> detail(@PathVariable String id) {
        return Result.ok(progressService.get(id));
    }

    @PostMapping("/tasks")
    public Result<ProgressTaskVO> create(@RequestBody CreateProgressTaskCmd cmd) {
        return Result.ok(progressService.create(cmd));
    }

    @PutMapping("/tasks/{id}")
    public Result<ProgressTaskVO> update(@PathVariable String id, @RequestBody UpdateProgressTaskCmd cmd) {
        return Result.ok(progressService.update(id, cmd));
    }

    @PutMapping("/tasks/{id}/status")
    public Result<ProgressTaskVO> status(@PathVariable String id, @RequestBody UpdateProgressStatusCmd cmd) {
        return Result.ok(progressService.updateStatus(id, cmd));
    }

    @DeleteMapping("/tasks/{id}")
    public Result<Void> delete(@PathVariable String id) {
        progressService.delete(id);
        return Result.ok();
    }

    @PostMapping("/tasks/{id}/submissions")
    public Result<ProgressTaskVO> submit(
            @PathVariable String id,
            @RequestParam(required = false) Integer progress,
            @RequestParam(required = false) String note,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String dueAt,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "false") boolean review,
            @RequestParam(required = false) MultipartFile[] files) {
        return Result.ok(progressService.submit(id, progress, note, description, dueAt, status, review, files));
    }

    @PostMapping("/tasks/{id}/review")
    public Result<ProgressTaskVO> review(@PathVariable String id, @RequestBody ReviewProgressCmd cmd) {
        return Result.ok(progressService.review(id, cmd));
    }
}
