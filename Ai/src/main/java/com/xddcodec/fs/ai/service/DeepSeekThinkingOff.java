/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import dev.langchain4j.exception.HttpException;
import dev.langchain4j.http.client.HttpClient;
import dev.langchain4j.http.client.HttpClientBuilder;
import dev.langchain4j.http.client.HttpRequest;
import dev.langchain4j.http.client.SuccessfulHttpResponse;
import dev.langchain4j.http.client.spring.restclient.SpringRestClientBuilder;
import dev.langchain4j.http.client.sse.ServerSentEvent;
import dev.langchain4j.http.client.sse.ServerSentEventListener;
import dev.langchain4j.http.client.sse.ServerSentEventParser;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * deepseek-flash 默认把 token 花在 reasoning_content 上，兼容接口看不到正文，工具也迟迟不调用。
 * 只对 api.deepseek.com 的请求加上 thinking.type=disabled。
 */
final class DeepSeekThinkingOff {

    private static final Logger log = LoggerFactory.getLogger(DeepSeekThinkingOff.class);
    private static final String THINKING = "\"thinking\":{\"type\":\"disabled\"},";

    private DeepSeekThinkingOff() {
    }

    static boolean applies(String baseUrl) {
        return baseUrl != null && baseUrl.toLowerCase(Locale.ROOT).contains("api.deepseek.com");
    }

    static HttpClientBuilder clientBuilder() {
        return new Builder();
    }

    private static final class Builder implements HttpClientBuilder {
        private Duration connectTimeout = Duration.ofSeconds(15);
        private Duration readTimeout = Duration.ofSeconds(120);

        @Override
        public Duration connectTimeout() {
            return connectTimeout;
        }

        @Override
        public HttpClientBuilder connectTimeout(Duration timeout) {
            this.connectTimeout = timeout;
            return this;
        }

        @Override
        public Duration readTimeout() {
            return readTimeout;
        }

        @Override
        public HttpClientBuilder readTimeout(Duration timeout) {
            this.readTimeout = timeout;
            return this;
        }

        @Override
        public HttpClient build() {
            HttpClient delegate = new SpringRestClientBuilder()
                    .connectTimeout(connectTimeout)
                    .readTimeout(readTimeout)
                    .build();
            return new Rewriting(delegate);
        }
    }

    private static final class Rewriting implements HttpClient {
        private final HttpClient delegate;

        private Rewriting(HttpClient delegate) {
            this.delegate = delegate;
        }

        @Override
        public SuccessfulHttpResponse execute(HttpRequest request) throws HttpException {
            return delegate.execute(rewrite(request));
        }

        @Override
        public void execute(HttpRequest request, ServerSentEventParser parser, ServerSentEventListener listener) {
            delegate.execute(rewrite(request), parser, guard(listener));
        }

        /** 工具回调里的异常会被 Spring RestClient 吃掉，界面会一直停在暂停。 */
        private static ServerSentEventListener guard(ServerSentEventListener listener) {
            return new ServerSentEventListener() {
                @Override
                public void onOpen(SuccessfulHttpResponse response) {
                    listener.onOpen(response);
                }

                @Override
                public void onEvent(ServerSentEvent event) {
                    try {
                        listener.onEvent(event);
                    } catch (Throwable error) {
                        log.warn("sse event failed", error);
                        listener.onError(error);
                    }
                }

                @Override
                public void onError(Throwable error) {
                    listener.onError(error);
                }

                @Override
                public void onClose() {
                    try {
                        listener.onClose();
                    } catch (Throwable error) {
                        log.warn("sse close failed", error);
                        listener.onError(error);
                    }
                }
            };
        }

        private static HttpRequest rewrite(HttpRequest request) {
            String body = request.body();
            if (body == null || body.isBlank()) {
                return request;
            }
            int brace = body.indexOf('{');
            if (brace < 0 || body.contains("\"thinking\"")) {
                return request;
            }
            String patched = body.substring(0, brace + 1) + THINKING + body.substring(brace + 1);
            log.debug("deepseek thinking disabled, body {} -> {}", body.length(), patched.length());
            Map<String, List<String>> headers = new LinkedHashMap<>();
            request.headers().forEach((name, values) -> {
                if (!"Content-Length".equalsIgnoreCase(name)) {
                    headers.put(name, values);
                }
            });
            return HttpRequest.builder()
                    .method(request.method())
                    .url(request.url())
                    .headers(headers)
                    .body(patched)
                    .build();
        }
    }
}
