/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.ai.config.AiEmbeddingProperties;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class QwenEmbeddingClient {

    private final AiEmbeddingProperties properties;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    public boolean configured() {
        return StringUtils.isNotBlank(properties.getApiKey());
    }

    public List<float[]> embed(List<String> texts) {
        if (!configured()) {
            throw new BusinessException(400, "未配置 embedding API Key（fs.ai.embedding.api-key）");
        }
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        List<float[]> out = new ArrayList<>();
        int batch = 8;
        for (int i = 0; i < texts.size(); i += batch) {
            List<String> slice = texts.subList(i, Math.min(i + batch, texts.size()));
            out.addAll(request(slice));
        }
        return out;
    }

    private List<float[]> request(List<String> inputs) {
        String base = StringUtils.removeEnd(properties.getBaseUrl().trim(), "/");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", properties.getModel());
        body.put("input", inputs);
        body.put("dimensions", properties.getDimensions());
        String raw = webClientBuilder.build()
                .post()
                .uri(base + "/embeddings")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey().trim())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
        try {
            JsonNode data = objectMapper.readTree(raw).path("data");
            List<float[]> vectors = new ArrayList<>();
            for (JsonNode item : data) {
                JsonNode emb = item.path("embedding");
                float[] vec = new float[emb.size()];
                for (int i = 0; i < emb.size(); i++) {
                    vec[i] = (float) emb.get(i).asDouble();
                }
                vectors.add(vec);
            }
            if (vectors.size() != inputs.size()) {
                throw new BusinessException(502, "embedding 返回条数与输入不一致");
            }
            return vectors;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(502, "embedding 解析失败: " + e.getMessage());
        }
    }
}