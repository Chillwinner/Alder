/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.controller;

import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.system.domain.dto.SaveCalendarEventCmd;
import com.xddcodec.fs.system.domain.vo.UserCalendarEventVO;
import com.xddcodec.fs.system.service.UserCalendarService;
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

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/calendar")
@Tag(name = "个人日历")
public class CalendarController {

    private final UserCalendarService calendarService;

    @GetMapping("/events")
    @Operation(summary = "区间内有交集的日程")
    public Result<List<UserCalendarEventVO>> list(
            @RequestParam OffsetDateTime from,
            @RequestParam OffsetDateTime to) {
        return Result.ok(calendarService.list(from, to));
    }

    @PostMapping("/events")
    @Operation(summary = "创建日程")
    public Result<UserCalendarEventVO> create(@RequestBody SaveCalendarEventCmd cmd) {
        return Result.ok(calendarService.create(cmd));
    }

    @PutMapping("/events/{id}")
    @Operation(summary = "修改自己的日程")
    public Result<UserCalendarEventVO> update(
            @PathVariable String id,
            @RequestBody SaveCalendarEventCmd cmd) {
        return Result.ok(calendarService.update(id, cmd));
    }

    @DeleteMapping("/events/{id}")
    @Operation(summary = "删除自己的日程")
    public Result<Void> delete(@PathVariable String id) {
        calendarService.delete(id);
        return Result.ok();
    }
}
