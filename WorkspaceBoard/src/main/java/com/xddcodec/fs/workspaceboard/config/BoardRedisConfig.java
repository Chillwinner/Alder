/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.workspaceboard.domain.dto.MemoSyncPayload;
import com.xddcodec.fs.workspaceboard.support.BoardConstants;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Configuration
@RequiredArgsConstructor
public class BoardRedisConfig {

    @Bean
    public RedisMessageListenerContainer boardRedisListener(RedisConnectionFactory factory,
                                                            SimpMessagingTemplate messaging,
                                                            ObjectMapper objectMapper) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener((MessageListener) (Message message, byte[] pattern) -> {
            try {
                MemoSyncPayload payload = objectMapper.readValue(message.getBody(), MemoSyncPayload.class);
                if (payload.getMemoId() != null) {
                    messaging.convertAndSend(BoardConstants.memoTopic(payload.getMemoId()), payload);
                }
            } catch (Exception ignored) {
            }
        }, new ChannelTopic(BoardConstants.REDIS_CHANNEL));
        return container;
    }
}
