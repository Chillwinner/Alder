/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class LocalQuotaSchemaInitializer {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void init() {
        try {
            String sql = new ClassPathResource("sql/local_quota_schema.sql")
                    .getContentAsString(StandardCharsets.UTF_8);
            for (String statement : sql.split(";")) {
                String trimmed = statement.trim();
                if (!trimmed.isEmpty()) {
                    execQuiet(trimmed);
                }
            }
            log.info("Local quota schema initialized");
        } catch (Exception e) {
            log.error("Failed to initialize local quota schema", e);
        }
    }

    private void execQuiet(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            log.warn("Local quota schema statement failed: {} — {}",
                    sql.lines().findFirst().orElse("").trim(), e.getMessage());
        }
    }
}
