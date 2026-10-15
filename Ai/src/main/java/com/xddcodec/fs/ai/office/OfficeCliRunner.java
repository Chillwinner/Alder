/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.office;

import com.xddcodec.fs.ai.config.OfficeCliProperties;
import com.xddcodec.fs.Exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class OfficeCliRunner {

    private static final Set<String> READ = Set.of("view", "get", "query", "validate", "help");
    private static final Set<String> WRITE = Set.of("set", "add", "remove", "move", "swap", "batch");

    private final OfficeCliProperties properties;

    private volatile Boolean cachedReady;

    public boolean available() {
        if (StringUtils.isNotBlank(properties.getRemoteUrl())) {
            return pingRemote();
        }
        if (cachedReady != null) {
            return cachedReady;
        }
        if (!properties.isEnabled() || StringUtils.isBlank(properties.getBinary())) {
            cachedReady = false;
            return false;
        }
        try {
            Process process = new ProcessBuilder(properties.getBinary(), "help")
                    .redirectErrorStream(true)
                    .start();
            boolean done = process.waitFor(8, TimeUnit.SECONDS);
            if (!done) {
                process.destroyForcibly();
                return false;
            }
            cachedReady = process.exitValue() == 0;
            return cachedReady;
        } catch (Exception e) {
            cachedReady = false;
            return false;
        }
    }

    public String exec(Path workDir, Path file, String verb, String extra, boolean write) throws Exception {
        String op = verb == null ? "" : verb.trim().toLowerCase(Locale.ROOT);
        if (write) {
            if (!WRITE.contains(op)) {
                throw new BusinessException("不允许的写操作: " + op);
            }
        } else if (!READ.contains(op)) {
            throw new BusinessException("不允许的读操作: " + op);
        }
        if (extra != null && (extra.contains("..") || extra.contains("://"))) {
            throw new BusinessException("参数不合法");
        }
        return execTokens(workDir, file, op, tokenize(extra), write);
    }

    public String execTokens(Path workDir, Path file, String verb, List<String> tokens, boolean write) throws Exception {
        String op = verb == null ? "" : verb.trim().toLowerCase(Locale.ROOT);
        if (write) {
            if (!WRITE.contains(op)) {
                throw new BusinessException("不允许的写操作: " + op);
            }
        } else if (!READ.contains(op)) {
            throw new BusinessException("不允许的读操作: " + op);
        }
        if (tokens != null) {
            for (String token : tokens) {
                if (token != null && (token.contains("..") || token.contains("://"))) {
                    throw new BusinessException("参数不合法");
                }
            }
        }
        if (StringUtils.isNotBlank(properties.getRemoteUrl())) {
            return execRemote(file, op, tokens == null ? List.of() : tokens);
        }
        List<String> cmd = new ArrayList<>();
        cmd.add(properties.getBinary());
        cmd.add(op);
        cmd.add(file.getFileName().toString());
        if (tokens != null) {
            cmd.addAll(tokens);
        }
        ProcessBuilder builder = new ProcessBuilder(cmd);
        builder.directory(workDir.toFile());
        builder.redirectErrorStream(true);
        Process process = builder.start();
        boolean done = process.waitFor(Math.max(10, properties.getTimeoutSeconds()), TimeUnit.SECONDS);
        if (!done) {
            process.destroyForcibly();
            throw new BusinessException("officecli 超时");
        }
        String out = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        if (process.exitValue() != 0) {
            throw new BusinessException(StringUtils.abbreviate(out, 2000));
        }
        return StringUtils.abbreviate(out, 8000);
    }

    private boolean pingRemote() {
        try {
            HttpResponse<String> res = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder()
                            .uri(URI.create(trimUrl(properties.getRemoteUrl()) + "/health"))
                            .timeout(Duration.ofSeconds(4))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            return res.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private String execRemote(Path file, String op, List<String> extra) throws Exception {
        String suffix = file.getFileName().toString();
        int dot = suffix.lastIndexOf('.');
        suffix = dot >= 0 ? suffix.substring(dot + 1) : "docx";
        String argsJson = asciiJson(extra);
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(trimUrl(properties.getRemoteUrl()) + "/exec"))
                .timeout(Duration.ofSeconds(Math.max(15, properties.getTimeoutSeconds())))
                .header("X-Officecli-Verb", op)
                .header("X-Officecli-Suffix", suffix)
                .header("X-Officecli-Args", argsJson)
                .POST(HttpRequest.BodyPublishers.ofByteArray(Files.readAllBytes(file)));
        if (StringUtils.isNotBlank(properties.getToken())) {
            builder.header("X-Officecli-Token", properties.getToken());
        }
        HttpResponse<byte[]> res = HttpClient.newHttpClient()
                .send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
        String log = URLDecoder.decode(
                res.headers().firstValue("X-Officecli-Log").orElse(""),
                StandardCharsets.UTF_8);
        if (res.statusCode() == 200 && res.body() != null && res.body().length > 0) {
            Files.write(file, res.body());
        }
        if (res.statusCode() != 200) {
            throw new BusinessException(StringUtils.defaultIfBlank(StringUtils.abbreviate(log, 2000),
                    "远程 officecli 失败 HTTP " + res.statusCode()));
        }
        return StringUtils.abbreviate(log, 8000);
    }

    private static String trimUrl(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public static void assertSafeWorkFile(Path workDir, Path file) throws IOException {
        Path root = workDir.toAbsolutePath().normalize();
        Path target = file.toAbsolutePath().normalize();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) {
            throw new BusinessException("工作文件无效");
        }
    }

    /** HTTP 头只能是 ASCII。JSON 的 \\u 转义由远端 json.loads 还原成中文。 */
    private static String asciiJson(List<String> extra) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < extra.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"');
            String value = extra.get(i);
            for (int offset = 0; offset < value.length(); ) {
                int cp = value.codePointAt(offset);
                offset += Character.charCount(cp);
                if (cp == '"' || cp == '\\') {
                    sb.append('\\').append((char) cp);
                } else if (cp == '\n') {
                    sb.append("\\n");
                } else if (cp == '\r') {
                    sb.append("\\r");
                } else if (cp >= 0x20 && cp <= 0x7e) {
                    sb.append((char) cp);
                } else if (cp <= 0xFFFF) {
                    sb.append(String.format("\\u%04x", cp));
                } else {
                    char[] pair = Character.toChars(cp);
                    sb.append(String.format("\\u%04x\\u%04x", (int) pair[0], (int) pair[1]));
                }
            }
            sb.append('"');
        }
        sb.append(']');
        return sb.toString();
    }

    private static List<String> tokenize(String extra) {
        if (StringUtils.isBlank(extra)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        char quote = 0;
        for (int i = 0; i < extra.length(); i++) {
            char c = extra.charAt(i);
            if (quote == 0 && (c == '"' || c == '\'')) {
                quote = c;
                continue;
            }
            if (quote != 0 && c == quote) {
                quote = 0;
                continue;
            }
            if (quote == 0 && Character.isWhitespace(c)) {
                if (!cur.isEmpty()) {
                    out.add(cur.toString());
                    cur.setLength(0);
                }
                continue;
            }
            cur.append(c);
        }
        if (!cur.isEmpty()) {
            out.add(cur.toString());
        }
        return joinPropValues(out);
    }

    /** 模型常把「--prop text=1. 有空格的句子」拆开，officecli 会把后半段当成非法属性。 */
    private static List<String> joinPropValues(List<String> tokens) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);
            if (("--prop".equals(token) || "--commands".equals(token)) && i + 1 < tokens.size()) {
                out.add(token);
                StringBuilder value = new StringBuilder(tokens.get(++i));
                while (i + 1 < tokens.size() && !tokens.get(i + 1).startsWith("--")) {
                    value.append(' ').append(tokens.get(++i));
                }
                out.add(value.toString());
                continue;
            }
            out.add(token);
        }
        return out;
    }
}
