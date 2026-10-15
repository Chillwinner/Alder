/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.config;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.workspaceboard.support.BoardConstants;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

@Configuration
public class BoardWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/workspace-board")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HandshakeInterceptor() {
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        String userId = resolveUserId(request);
                        if (StringUtils.isBlank(userId)) {
                            return false;
                        }
                        attributes.put("principal", (Principal) () -> BoardConstants.userPrincipal(userId));
                        return true;
                    }

                    @Override
                    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                               WebSocketHandler wsHandler, Exception exception) {
                    }
                })
                .setHandshakeHandler(new DefaultHandshakeHandler() {
                    @Override
                    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                                      Map<String, Object> attributes) {
                        Object principal = attributes.get("principal");
                        return principal instanceof Principal p ? p : null;
                    }
                });
    }

    private String resolveUserId(ServerHttpRequest request) {
        if (!(request instanceof ServletServerHttpRequest servlet)) {
            return null;
        }
        var httpRequest = servlet.getServletRequest();
        String token = httpRequest.getParameter("access_token");
        if (StringUtils.isBlank(token)) {
            String authorization = httpRequest.getHeader("Authorization");
            if (StringUtils.isNotBlank(authorization) && authorization.startsWith("Bearer ")) {
                token = authorization.substring(7).trim();
            }
        }
        if (StringUtils.isNotBlank(token)) {
            Object loginId = StpUtil.getLoginIdByToken(token);
            if (loginId != null) {
                return String.valueOf(loginId);
            }
        }
        try {
            if (StpUtil.isLogin()) {
                return StpUtil.getLoginIdAsString();
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }
}
