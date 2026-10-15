package com.xddcodec.fs.site;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SiteSettingsRuntime {

    private final ConcurrentHashMap<String, String> values = new ConcurrentHashMap<>();

    public void putAll(Map<String, String> next) {
        if (next == null) {
            return;
        }
        next.forEach((k, v) -> {
            if (k == null) {
                return;
            }
            if (v == null || v.isBlank()) {
                values.remove(k);
            } else {
                values.put(k, v);
            }
        });
    }

    public void put(String key, String value) {
        if (!StringUtils.hasText(key)) {
            return;
        }
        if (!StringUtils.hasText(value)) {
            values.remove(key);
        } else {
            values.put(key, value);
        }
    }

    public String get(String key) {
        return values.get(key);
    }

    public String getOrDefault(String key, String fallback) {
        String v = values.get(key);
        return StringUtils.hasText(v) ? v : fallback;
    }

    public boolean getBoolean(String key, boolean fallback) {
        String v = values.get(key);
        if (!StringUtils.hasText(v)) {
            return fallback;
        }
        return "1".equals(v) || "true".equalsIgnoreCase(v);
    }

    public int getInt(String key, int fallback) {
        String v = values.get(key);
        if (!StringUtils.hasText(v)) {
            return fallback;
        }
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public List<String> corsOrigins(String fallbackCsv) {
        String raw = getOrDefault(SiteSettingsKeys.CORS_ORIGINS, fallbackCsv);
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
