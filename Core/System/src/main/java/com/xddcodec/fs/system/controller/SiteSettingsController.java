package com.xddcodec.fs.system.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.System.domain.dto.ExportSiteSettingsCmd;
import com.xddcodec.fs.System.domain.dto.ImportSiteSettingsCmd;
import com.xddcodec.fs.System.domain.dto.UpdateSiteSettingsCmd;
import com.xddcodec.fs.System.domain.vo.SiteSettingsBoxVO;
import com.xddcodec.fs.System.domain.vo.SiteSettingsVO;
import com.xddcodec.fs.system.service.SiteSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/apis/admin/site-settings")
@RequiredArgsConstructor
@Tag(name = "站点配置")
public class SiteSettingsController {

    private final SiteSettingsService siteSettingsService;

    @GetMapping
    @SaCheckPermission("storage:manage")
    @Operation(summary = "读取站点配置（密钥只回是否已设置）")
    public Result<SiteSettingsVO> get() {
        return Result.ok(siteSettingsService.get());
    }

    @PutMapping
    @SaCheckPermission("storage:manage")
    @Operation(summary = "保存站点配置")
    public Result<SiteSettingsVO> update(@RequestBody UpdateSiteSettingsCmd cmd) {
        siteSettingsService.update(cmd);
        return Result.ok(siteSettingsService.get());
    }

    @PostMapping("/export")
    @SaCheckPermission("storage:manage")
    @Operation(summary = "导出加密 alder-site.box")
    public Result<SiteSettingsBoxVO> export(@Valid @RequestBody ExportSiteSettingsCmd cmd) {
        return Result.ok(siteSettingsService.exportBox(cmd));
    }

    @PostMapping("/import")
    @SaCheckPermission("storage:manage")
    @Operation(summary = "导入 alder-site.box")
    public Result<SiteSettingsVO> importBox(@Valid @RequestBody ImportSiteSettingsCmd cmd) {
        siteSettingsService.importBox(cmd);
        return Result.ok(siteSettingsService.get());
    }
}
