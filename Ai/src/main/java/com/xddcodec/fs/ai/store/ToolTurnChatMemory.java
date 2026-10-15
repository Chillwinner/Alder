/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.store;

import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;

import java.util.List;

/**
 * 残缺的 tool 回合只在下一条用户消息写入前丢掉。
 * 工具执行过程中的两次 add 必须原样落库，否则模型会反复调用同一个工具。
 */
public final class ToolTurnChatMemory implements ChatMemory {

    private final Object id;
    private final RedisChatMemoryStore store;
    private final ChatMemory delegate;

    private ToolTurnChatMemory(Object id, RedisChatMemoryStore store, ChatMemory delegate) {
        this.id = id;
        this.store = store;
        this.delegate = delegate;
    }

    public static ChatMemory create(Object memoryId, RedisChatMemoryStore store) {
        ChatMemory delegate = MessageWindowChatMemory.builder()
                .id(memoryId)
                .maxMessages(80)
                .chatMemoryStore(store)
                .build();
        return new ToolTurnChatMemory(memoryId, store, delegate);
    }

    @Override
    public Object id() {
        return id;
    }

    @Override
    public void add(ChatMessage message) {
        if (message instanceof UserMessage) {
            List<ChatMessage> cleaned = RedisChatMemoryStore.dropBrokenToolTurns(store.getMessages(id));
            store.updateMessages(id, cleaned);
        }
        delegate.add(message);
    }

    @Override
    public List<ChatMessage> messages() {
        return delegate.messages();
    }

    @Override
    public void clear() {
        delegate.clear();
    }
}
