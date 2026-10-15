/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Interceptor;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

/**
 * 工作空间拦截器 - 从请求头或请求参数提取工作空间ID并验证成员身份
 * 
 * 工作空间ID获取优先级：
 * 1. 请求头 X-Workspace-Id（推荐，用于 API 调用）
 * 2. 请求参数 X-Workspace-Id（用于无法设置请求头的场景，如文件下载）
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkspaceInterceptor implements HandlerInterceptor {

    private final SysWorkspaceMemberMapper memberMapper;

    @Value("${fs.header-workspace-id}")
    private String workspaceIdHeader;

    // 不需要工作空间上下文的白名单
    private static final Set<String> WHITELIST = Set.of(
            "/apis/auth/login",
            "/apis/auth/logout",
            "/apis/user/register",
            "/apis/user/info",
            "/apis/user/password",
            "/apis/user/forget-password",
            "/apis/workspace/list",
            "/apis/workspace/check-slug",
            "/apis/permission/list",
            "/apis/i18n",
            "/apis/transfer/sse",
            "/apis/file-collections/public",
            "/apis/invitation/verify",  // 邀请验证接口（公开）
            "/apis/invitation/accept",  // 邀请接受（需登录，无需工作空间）
            "/apis/invitation/mine",    // 我的待处理邀请
            "/apis/invitation/reject",  // 拒绝邀请
            "/apis/workspace-votes/pending", // 待我表态的投票（跨工作空间）
            "/apis/workspace-meetings/pending", // 待参加的工作空间会议（跨工作空间）
            "/apis/calendar", // 个人日历，不绑工作空间
            "/apis/lan" // 局域网互传，按登录用户，不绑工作空间
    );

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws IOException {
        // SseEmitter 异步二次分发时 Sa-Token 过滤器不会再包一层
        if (req.getDispatcherType() == DispatcherType.ASYNC) {
            return true;
        }

        String path = req.getRequestURI();

        // 白名单直接放行
        if (WHITELIST.stream().anyMatch(path::startsWith)) {
            return true;
        }

        // POST /apis/workspace（创建工作空间）也不需要
        if ("POST".equals(req.getMethod()) && "/apis/workspace".equals(path)) {
            return true;
        }

        // 获取工作空间ID - 优先从请求头获取，如果没有则从请求参数获取
        String workspaceId = req.getHeader(workspaceIdHeader);
        if (workspaceId == null || workspaceId.isBlank()) {
            workspaceId = req.getParameter(workspaceIdHeader);
        }
        
        if (workspaceId == null || workspaceId.isBlank()) {
            writeError(res, ErrorMessages.WORKSPACE_ID_REQUIRED);
            return false;
        }

        // 校验当前用户是否为该工作空间成员
        if (!StpUtil.isLogin()) {
            writeError(res, ErrorMessages.AUTH_NOT_TOKEN);
            return false;
        }

        String userId = StpUtil.getLoginIdAsString();
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            writeError(res, ErrorMessages.WORKSPACE_NOT_MEMBER);
            return false;
        }

        // 设置工作空间上下文
        WorkspaceContext.setWorkspaceId(workspaceId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // 清除工作空间上下文
        WorkspaceContext.clear();
    }

    private void writeError(HttpServletResponse res, ErrorMessages error) throws IOException {
        res.setStatus(error.getCode());
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"code\":" + error.getCode() + ",\"msg\":\"" + error.getKey() + "\"}");
    }
}
