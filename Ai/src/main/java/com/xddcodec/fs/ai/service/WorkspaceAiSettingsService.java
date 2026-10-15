/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.ai.domain.WorkspaceAiSettings;
import com.xddcodec.fs.ai.domain.dto.UpdateWorkspaceAiSettingsCmd;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiSettingsVO;
import com.xddcodec.fs.ai.mapper.WorkspaceAiSettingsMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkspaceAiSettingsService {

    public static final String DEFAULT_BASE_URL = "https://api.deepseek.com";
    public static final String DEFAULT_MODEL = "deepseek-flash";
    public static final String DEFAULT_PROMPT = """
            回答简洁，先给结论再补要点。能用工具核实的不要猜。不确定就明说，并给出下一步。语气克制，少套话。""";

    private final WorkspaceAiSettingsMapper mapper;
    private final WorkspaceAiAgentFactory agentFactory;

    public synchronized void ensureTable() {
        mapper.ensureTable();
    }

    public WorkspaceAiSettingsVO getCurrent(boolean canEdit) {
        ensureTable();
        WorkspaceAiSettings row = mapper.selectByWorkspace(WorkspaceContext.getWorkspaceId());
        WorkspaceAiSettingsVO vo = new WorkspaceAiSettingsVO();
        vo.setEnabled(row == null || row.getEnabled() == null || row.getEnabled());
        vo.setBaseUrl(row != null && StringUtils.isNotBlank(row.getBaseUrl())
                ? row.getBaseUrl().trim()
                : DEFAULT_BASE_URL);
        vo.setModelName(row != null && StringUtils.isNotBlank(row.getModelName())
                ? row.getModelName().trim()
                : DEFAULT_MODEL);
        String storedPrompt = row != null ? trim(row.getCustomPrompt()) : "";
        vo.setCustomPrompt(StringUtils.isNotBlank(storedPrompt) ? storedPrompt : DEFAULT_PROMPT);
        boolean workspaceKey = row != null && StringUtils.isNotBlank(row.getApiKey());
        vo.setUsingWorkspaceKey(workspaceKey);
        vo.setApiKeyConfigured(workspaceKey);
        vo.setApiKeyMasked(workspaceKey ? maskKey(row.getApiKey()) : "");
        vo.setCanEdit(canEdit);
        return vo;
    }

    public WorkspaceAiSettingsVO save(UpdateWorkspaceAiSettingsCmd cmd, boolean canEdit) {
        if (!canEdit) {
            throw new BusinessException(403, "只有管理员可以修改本空间助手");
        }
        if (cmd == null) {
            throw new BusinessException("配置不能为空");
        }
        ensureTable();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        WorkspaceAiSettings current = mapper.selectByWorkspace(workspaceId);
        WorkspaceAiSettings next = new WorkspaceAiSettings();
        next.setWorkspaceId(workspaceId);
        next.setEnabled(cmd.getEnabled() == null || cmd.getEnabled());
        next.setBaseUrl(StringUtils.defaultIfBlank(trim(cmd.getBaseUrl()),
                current != null ? current.getBaseUrl() : DEFAULT_BASE_URL));
        next.setModelName(StringUtils.defaultIfBlank(trim(cmd.getModelName()),
                current != null ? current.getModelName() : DEFAULT_MODEL));
        String prompt = trim(cmd.getCustomPrompt());
        next.setCustomPrompt(StringUtils.isNotBlank(prompt) ? prompt : DEFAULT_PROMPT);
        if (Boolean.TRUE.equals(cmd.getClearApiKey())) {
            next.setApiKey(null);
        } else if (StringUtils.isNotBlank(cmd.getApiKey())) {
            next.setApiKey(cmd.getApiKey().trim());
        } else {
            next.setApiKey(current != null ? current.getApiKey() : null);
        }
        next.setUpdatedBy(UserContext.getUserId());
        mapper.upsert(next);
        agentFactory.evict(workspaceId);
        return getCurrent(true);
    }

    public ResolvedAiEndpoint resolveForChat() {
        ensureTable();
        WorkspaceAiSettings row = mapper.selectByWorkspace(WorkspaceContext.getWorkspaceId());
        boolean enabled = row != null && (row.getEnabled() == null || row.getEnabled());
        if (!enabled) {
            throw new BusinessException("本空间助手未启用，请在空间 AI 页开启并保存");
        }
        String apiKey = row != null ? trim(row.getApiKey()) : "";
        if (StringUtils.isBlank(apiKey)) {
            throw new BusinessException("本空间尚未配置 API Key，请在空间 AI 页填写并保存");
        }
        String baseUrl = row != null && StringUtils.isNotBlank(row.getBaseUrl())
                ? row.getBaseUrl().trim()
                : DEFAULT_BASE_URL;
        String model = row != null && StringUtils.isNotBlank(row.getModelName())
                ? row.getModelName().trim()
                : DEFAULT_MODEL;
        String prompt = row != null ? trim(row.getCustomPrompt()) : "";
        if (StringUtils.isBlank(prompt)) {
            prompt = DEFAULT_PROMPT;
        }
        return new ResolvedAiEndpoint(
                WorkspaceContext.getWorkspaceId(),
                apiKey,
                baseUrl,
                model,
                prompt,
                true);
    }

    private static String maskKey(String key) {
        String raw = key.trim();
        if (raw.length() <= 4) {
            return "••••";
        }
        return "••••" + raw.substring(raw.length() - 4);
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public record ResolvedAiEndpoint(
            String workspaceId,
            String apiKey,
            String baseUrl,
            String modelName,
            String customPrompt,
            boolean workspaceKey
    ) {
        public String fingerprint() {
            return workspaceId + "|" + baseUrl + "|" + modelName + "|" + apiKey.hashCode();
        }
    }
}
