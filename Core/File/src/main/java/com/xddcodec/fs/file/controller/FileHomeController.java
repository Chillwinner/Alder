/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.controller;

import com.xddcodec.fs.File.domain.qry.FileHomeUsedBytesQry;
import com.xddcodec.fs.File.domain.vo.FileHomeVO;
import com.xddcodec.fs.File.domain.vo.HostLoadVO;
import com.xddcodec.fs.file.service.FileHomeService;
import com.xddcodec.fs.file.service.HostLoadService;
import com.xddcodec.fs.Result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@Slf4j
@RestController
@RequestMapping("/apis/home")
@Tag(name = "文件首页", description = "首页")
public class FileHomeController {

    @Autowired
    private FileHomeService fileHomeService;
    @Autowired
    private HostLoadService hostLoadService;

    @GetMapping("/info")
    @Operation(summary = "查询首页信息", description = "查询首页信息")
    public Result<FileHomeVO> getHomes(FileHomeUsedBytesQry qry) {
        FileHomeVO homeVO = fileHomeService.getFileHomes(qry);
        return Result.ok(homeVO);
    }

    @GetMapping("/host-load")
    @Operation(summary = "本机负载", description = "本机 CPU / 内存占用，供首页仪表用")
    public Result<HostLoadVO> getHostLoad() {
        return Result.ok(hostLoadService.snapshot());
    }
}
