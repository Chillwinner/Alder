/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import com.xddcodec.fs.ai.tool.OfficeAiTools;
import com.xddcodec.fs.ai.tool.WorkspaceAiTools;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import dev.langchain4j.service.AiServices;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WorkspaceAiAgentFactory {

    private final WorkspaceAiTools workspaceAiTools;
    private final OfficeAiTools officeAiTools;
    private final ChatMemoryProvider chatMemoryProvider;

    public WorkspaceAiAgentFactory(
            WorkspaceAiTools workspaceAiTools,
            OfficeAiTools officeAiTools,
            @Qualifier("cmp") ChatMemoryProvider chatMemoryProvider) {
        this.workspaceAiTools = workspaceAiTools;
        this.officeAiTools = officeAiTools;
        this.chatMemoryProvider = chatMemoryProvider;
    }

    private final ConcurrentHashMap<String, Cached> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CachedOffice> officeCache = new ConcurrentHashMap<>();

    public WorkspaceAiService agent(WorkspaceAiSettingsService.ResolvedAiEndpoint endpoint) {
        String fp = endpoint.fingerprint();
        Cached hit = cache.get(endpoint.workspaceId());
        if (hit != null && hit.fingerprint.equals(fp)) {
            return hit.agent;
        }
        OpenAiStreamingChatModel model = chatModel(endpoint);
        WorkspaceAiService agent = AiServices.builder(WorkspaceAiService.class)
                .streamingChatLanguageModel(model)
                .chatMemoryProvider(chatMemoryProvider)
                .tools(workspaceAiTools)
                .build();
        cache.put(endpoint.workspaceId(), new Cached(fp, agent));
        return agent;
    }

    public OfficeAiService officeAgent(WorkspaceAiSettingsService.ResolvedAiEndpoint endpoint) {
        String fp = endpoint.fingerprint();
        CachedOffice hit = officeCache.get(endpoint.workspaceId());
        if (hit != null && hit.fingerprint.equals(fp)) {
            return hit.agent;
        }
        OpenAiStreamingChatModel model = chatModel(endpoint);
        OfficeAiService agent = AiServices.builder(OfficeAiService.class)
                .streamingChatLanguageModel(model)
                .chatMemoryProvider(chatMemoryProvider)
                .tools(officeAiTools, workspaceAiTools)
                .maxSequentialToolsInvocations(8)
                .build();
        officeCache.put(endpoint.workspaceId(), new CachedOffice(fp, agent));
        return agent;
    }

    private static OpenAiStreamingChatModel chatModel(WorkspaceAiSettingsService.ResolvedAiEndpoint endpoint) {
        OpenAiStreamingChatModel.OpenAiStreamingChatModelBuilder builder = OpenAiStreamingChatModel.builder()
                .apiKey(endpoint.apiKey())
                .baseUrl(endpoint.baseUrl())
                .modelName(endpoint.modelName())
                .parallelToolCalls(false)
                .timeout(Duration.ofSeconds(90));
        if (DeepSeekThinkingOff.applies(endpoint.baseUrl())) {
            builder.httpClientBuilder(DeepSeekThinkingOff.clientBuilder());
        }
        return builder.build();
    }

    public void evict(String workspaceId) {
        if (workspaceId != null) {
            cache.remove(workspaceId);
            officeCache.remove(workspaceId);
        }
    }

    private record Cached(String fingerprint, WorkspaceAiService agent) {
    }

    private record CachedOffice(String fingerprint, OfficeAiService agent) {
    }
}
