/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.store;

import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.ChatMessageDeserializer;
import dev.langchain4j.data.message.ChatMessageSerializer;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.store.memory.chat.ChatMemoryStore;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class RedisChatMemoryStore implements ChatMemoryStore {

    private static final String KEY_PREFIX = "ai:chat:memory:";
    private static final long TTL_DAYS = 14;

    private final StringRedisTemplate redis;

    @Override
    public List<ChatMessage> getMessages(Object memoryId) {
        String json = redis.opsForValue().get(KEY_PREFIX + memoryId);
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        return ChatMessageDeserializer.messagesFromJson(json);
    }

    @Override
    public void updateMessages(Object memoryId, List<ChatMessage> messages) {
        String json = ChatMessageSerializer.messagesToJson(messages == null ? List.of() : messages);
        redis.opsForValue().set(KEY_PREFIX + memoryId, json, TTL_DAYS, TimeUnit.DAYS);
    }

    @Override
    public void deleteMessages(Object memoryId) {
        redis.delete(KEY_PREFIX + memoryId);
    }

    public void dropLastUserTurn(Object memoryId) {
        List<ChatMessage> kept = new ArrayList<>(getMessages(memoryId));
        while (!kept.isEmpty() && kept.get(kept.size() - 1) instanceof ToolExecutionResultMessage) {
            kept.remove(kept.size() - 1);
        }
        if (!kept.isEmpty() && kept.get(kept.size() - 1) instanceof AiMessage) {
            kept.remove(kept.size() - 1);
        }
        while (!kept.isEmpty() && kept.get(kept.size() - 1) instanceof ToolExecutionResultMessage) {
            kept.remove(kept.size() - 1);
        }
        if (!kept.isEmpty() && kept.get(kept.size() - 1) instanceof AiMessage ai && ai.hasToolExecutionRequests()) {
            kept.remove(kept.size() - 1);
        }
        if (!kept.isEmpty() && kept.get(kept.size() - 1) instanceof UserMessage) {
            kept.remove(kept.size() - 1);
        }
        updateMessages(memoryId, kept);
    }

    /**
     * 窗口裁切或流中断后，Redis 里可能只剩带 tool_calls 的助手消息、没有对应 tool 结果。
     * 只能在写入下一条用户消息之前调用。add(助手 tool_calls) 和 add(tool 结果) 之间如果先删，
     * 下一轮请求会丢掉这次工具调用，模型会用同一条请求无限重试。
     */
    public static List<ChatMessage> dropBrokenToolTurns(List<ChatMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return new ArrayList<>();
        }
        List<ChatMessage> out = new ArrayList<>();
        int i = 0;
        while (i < messages.size()) {
            ChatMessage current = messages.get(i);
            if (current instanceof AiMessage ai && ai.hasToolExecutionRequests()) {
                List<ToolExecutionRequest> requests = ai.toolExecutionRequests();
                int j = i + 1;
                Set<String> resultIds = new HashSet<>();
                int resultCount = 0;
                while (j < messages.size() && messages.get(j) instanceof ToolExecutionResultMessage tool) {
                    resultCount++;
                    if (tool.id() != null) {
                        resultIds.add(tool.id());
                    }
                    j++;
                }
                boolean complete;
                List<String> requestIds = requests.stream().map(ToolExecutionRequest::id).filter(Objects::nonNull).toList();
                if (!requestIds.isEmpty()) {
                    complete = resultIds.containsAll(requestIds);
                } else {
                    complete = resultCount >= requests.size();
                }
                if (complete) {
                    out.add(ai);
                    out.addAll(messages.subList(i + 1, j));
                }
                i = j;
                continue;
            }
            if (current instanceof ToolExecutionResultMessage) {
                i++;
                continue;
            }
            out.add(current);
            i++;
        }
        return out;
    }
}
