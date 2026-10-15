/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.config;

import com.xddcodec.fs.ai.store.RedisChatMemoryStore;
import com.xddcodec.fs.ai.store.ToolTurnChatMemory;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({AiEmbeddingProperties.class, OfficeCliProperties.class})
public class AiConfig {

    @Bean("cmp")
    public ChatMemoryProvider chatMemoryProvider(RedisChatMemoryStore redisChatMemoryStore) {
        return memoryId -> ToolTurnChatMemory.create(memoryId, redisChatMemoryStore);
    }
}
