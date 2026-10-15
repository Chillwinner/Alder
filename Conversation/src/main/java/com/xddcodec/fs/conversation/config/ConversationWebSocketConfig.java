/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.config;

import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.conversation.support.ImConstants;
import org.apache.commons.lang3.StringUtils;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
public class ConversationWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws/conversation")
                .setAllowedOriginPatterns("*")
                .addInterceptors(new HandshakeInterceptor() {
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        String userId = resolveUserId(request);
                        if (StringUtils.isBlank(userId)) {
                            return false;
                        }
                        attributes.put("principal", (Principal) () -> ImConstants.userPrincipal(userId));
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

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        int limit = 8 * 1024 * 1024;
        registration.setMessageSizeLimit(limit);
        registration.setSendBufferSizeLimit(limit);
        registration.setSendTimeLimit(30_000);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())
                        && accessor.getSessionAttributes() != null) {
                    Object principal = accessor.getSessionAttributes().get("principal");
                    if (principal instanceof Principal p) {
                        accessor.setUser(p);
                    }
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
