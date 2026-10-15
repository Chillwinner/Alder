/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.conversation.domain.dto.ImCryptoRegisterCmd;
import com.xddcodec.fs.conversation.domain.dto.ImGroupKeyWrapCmd;
import com.xddcodec.fs.conversation.domain.vo.ImCryptoMeVO;
import com.xddcodec.fs.conversation.domain.vo.ImGroupKeyWrapVO;
import com.xddcodec.fs.conversation.service.ImCryptoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/im/crypto")
@Tag(name = "IM 端到端加密")
public class ImCryptoController {

    private final ImCryptoService imCryptoService;

    @GetMapping("/me")
    @Operation(summary = "当前用户加密注册状态")
    public Result<ImCryptoMeVO> me() {
        return Result.ok(imCryptoService.me(requireUserId()));
    }

    @PostMapping("/register")
    @Operation(summary = "注册公钥与密钥校验包")
    public Result<Void> register(@RequestBody ImCryptoRegisterCmd cmd) {
        imCryptoService.register(requireUserId(), cmd);
        return Result.ok();
    }

    @GetMapping("/users/{userId}/public-key")
    @Operation(summary = "获取用户公钥")
    public Result<Map<String, String>> publicKey(@PathVariable String userId) {
        return Result.ok(Map.of("publicKeySpki", imCryptoService.publicKeyOf(userId)));
    }

    @GetMapping("/groups/{groupId}/wrap")
    @Operation(summary = "获取我在群内的密钥封装")
    public Result<ImGroupKeyWrapVO> groupWrap(@PathVariable String groupId) {
        return Result.ok(imCryptoService.myGroupWrap(requireUserId(), groupId));
    }

    @PutMapping("/groups/{groupId}/wraps")
    @Operation(summary = "发布群密钥封装（管理员/群主）")
    public Result<Void> publishGroupWraps(@PathVariable String groupId,
                                          @RequestBody ImGroupKeyWrapCmd cmd) {
        imCryptoService.publishGroupWraps(requireUserId(), groupId, cmd);
        return Result.ok();
    }

    @PostMapping("/groups/{groupId}/rotate")
    @Operation(summary = "清除群密钥封装（成员变更后轮换）")
    public Result<Void> rotateGroup(@PathVariable String groupId) {
        imCryptoService.rotateGroupKeys(requireUserId(), groupId);
        return Result.ok();
    }

    private static String requireUserId() {
        return UserContext.getUserId();
    }
}
