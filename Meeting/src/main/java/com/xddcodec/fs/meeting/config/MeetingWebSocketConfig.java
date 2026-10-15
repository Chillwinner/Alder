/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 *
 * 会议信令端点照 wbroom：CONNECT 时把 principal 设成 sessionId，
 * 这样 /user/queue/init 才能收到 INIT。登录用户 id 放在会话属性里做邀请校验。
 */

package com.xddcodec.fs.meeting.config;

import cn.dev33.satoken.stp.StpUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.security.Principal;
import java.util.Map;

@Configuration
@Order(Ordered.LOWEST_PRECEDENCE)
public class MeetingWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    public static final String ATTR_USER_ID = "meetingUserId";

    @Bean
    public ServletServerContainerFactoryBean meetingWebSocketContainer() {
        int limit = 8 * 1024 * 1024;
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(limit);
        container.setMaxBinaryMessageBufferSize(limit);
        return container;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/meeting")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HandshakeInterceptor() {
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        String userId = resolveUserId(request);
                        if (StringUtils.isBlank(userId)) {
                            return false;
                        }
                        attributes.put(ATTR_USER_ID, userId);
                        return true;
                    }

                    @Override
                    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                               WebSocketHandler wsHandler, Exception exception) {
                    }
                });
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null
                        && StompCommand.CONNECT.equals(accessor.getCommand())
                        && accessor.getSessionAttributes() != null
                        && accessor.getSessionAttributes().get(ATTR_USER_ID) != null
                        && accessor.getSessionId() != null) {
                    String sessionId = accessor.getSessionId();
                    Principal user = () -> sessionId;
                    accessor.setUser(user);
                }
                return message;
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
