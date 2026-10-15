/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.conversation.domain.dto.ImPush;
import com.xddcodec.fs.conversation.support.ImConstants;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Configuration
public class ConversationRedisConfig {

    @Bean
    public RedisMessageListenerContainer conversationRedisListener(RedisConnectionFactory factory,
                                                                   SimpMessagingTemplate messaging,
                                                                   ObjectMapper objectMapper) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener((MessageListener) (Message message, byte[] pattern) -> {
            try {
                ImPush push = objectMapper.readValue(message.getBody(), ImPush.class);
                if (push.getUserId() != null) {
                    messaging.convertAndSendToUser(
                            ImConstants.userPrincipal(push.getUserId()),
                            "/queue/conversation",
                            push
                    );
                }
            } catch (Exception ignored) {
            }
        }, new ChannelTopic(ImConstants.CHANNEL));
        return container;
    }
}
