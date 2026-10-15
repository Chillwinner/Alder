package com.xddcodec.fs.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.Storage.domain.StorageSetting;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.System.domain.dto.ExportSiteSettingsCmd;
import com.xddcodec.fs.System.domain.dto.ImportSiteSettingsCmd;
import com.xddcodec.fs.System.domain.dto.UpdateSiteSettingsCmd;
import com.xddcodec.fs.System.domain.vo.SiteSettingsBoxVO;
import com.xddcodec.fs.System.domain.vo.SiteSettingsVO;
import com.xddcodec.fs.site.SiteSettingsKeys;
import com.xddcodec.fs.site.SiteSettingsRuntime;
import com.xddcodec.fs.storage.mapper.StorageSettingMapper;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import com.xddcodec.fs.system.mapper.SiteSettingsMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.system.support.SiteBoxCrypto;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.File;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

@Slf4j
@Service
@DependsOn("siteSettingsSchemaInitializer")
@RequiredArgsConstructor
public class SiteSettingsService {

    private final SiteSettingsMapper siteSettingsMapper;
    private final SiteSettingsRuntime runtime;
    private final JavaMailSender mailSender;
    private final LocalStorageOperationService localStorage;
    private final StorageSettingMapper storageSettingMapper;
    private final SysWorkspaceMapper workspaceMapper;
    private final ObjectMapper objectMapper;

    @Value("${spring.mail.enable:true}")
    private boolean defaultMailEnable;
    @Value("${spring.mail.host:}")
    private String defaultMailHost;
    @Value("${spring.mail.port:465}")
    private int defaultMailPort;
    @Value("${spring.mail.username:}")
    private String defaultMailUsername;
    @Value("${spring.mail.password:}")
    private String defaultMailPassword;
    @Value("${spring.mail.form:}")
    private String defaultMailFrom;
    @Value("${fs.frontend.domain:http://localhost:5180}")
    private String defaultFrontend;
    @Value("${fs.cors.allowed-origins:http://localhost,http://127.0.0.1,http://localhost:5180,http://127.0.0.1:5180}")
    private String defaultCors;
    @Value("${turn.host:}")
    private String defaultTurnHost;
    @Value("${turn.port:3478}")
    private String defaultTurnPort;
    @Value("${turn.auth-secret:}")
    private String defaultTurnSecret;
    @Value("${turn.credential-ttl-seconds:86400}")
    private String defaultTurnTtl;
    @Value("${sa-token.jwt-secret-key:}")
    private String defaultJwt;
    @Value("${spring.datasource.url:}")
    private String datasourceUrl;
    @Value("${spring.data.redis.host:}")
    private String redisHost;
    @Value("${spring.data.redis.port:6379}")
    private String redisPort;

    @PostConstruct
    public void load() {
        Map<String, String> stored = readStored();
        runtime.putAll(defaults());
        runtime.putAll(stored);
        applyLive();
    }

    public SiteSettingsVO get() {
        SiteSettingsVO vo = new SiteSettingsVO();
        vo.setMailEnable(runtime.getBoolean(SiteSettingsKeys.MAIL_ENABLE, defaultMailEnable));
        vo.setMailHost(runtime.getOrDefault(SiteSettingsKeys.MAIL_HOST, defaultMailHost));
        vo.setMailPort(String.valueOf(runtime.getInt(SiteSettingsKeys.MAIL_PORT, defaultMailPort)));
        vo.setMailUsername(runtime.getOrDefault(SiteSettingsKeys.MAIL_USERNAME, defaultMailUsername));
        vo.setMailPasswordSet(StringUtils.hasText(runtime.getOrDefault(SiteSettingsKeys.MAIL_PASSWORD, defaultMailPassword)));
        vo.setMailFrom(runtime.getOrDefault(SiteSettingsKeys.MAIL_FROM, defaultMailFrom));
        vo.setMailSsl(runtime.getBoolean(SiteSettingsKeys.MAIL_SSL, true));
        vo.setFrontendDomain(runtime.getOrDefault(SiteSettingsKeys.FRONTEND_DOMAIN, defaultFrontend));
        vo.setCorsOrigins(runtime.getOrDefault(SiteSettingsKeys.CORS_ORIGINS, defaultCors));
        vo.setLocalBasePath(runtime.getOrDefault(SiteSettingsKeys.LOCAL_BASE_PATH, localStorage.getBasePath()));
        vo.setLocalBaseUrl(runtime.getOrDefault(SiteSettingsKeys.LOCAL_BASE_URL, localStorage.getBaseUrl()));
        vo.setTurnHost(runtime.getOrDefault(SiteSettingsKeys.TURN_HOST, defaultTurnHost));
        vo.setTurnPort(runtime.getOrDefault(SiteSettingsKeys.TURN_PORT, defaultTurnPort));
        vo.setTurnSecretSet(StringUtils.hasText(runtime.getOrDefault(SiteSettingsKeys.TURN_AUTH_SECRET, defaultTurnSecret)));
        vo.setTurnTtlSeconds(runtime.getOrDefault(SiteSettingsKeys.TURN_TTL, defaultTurnTtl));
        vo.setJwtSecretSet(StringUtils.hasText(runtime.getOrDefault(SiteSettingsKeys.JWT_SECRET, defaultJwt)));
        vo.setJwtNeedsRestart(true);
        vo.setPostgresHint(maskJdbc(datasourceUrl));
        vo.setRedisHint(redisHost + ":" + redisPort);
        return vo;
    }

    public void update(UpdateSiteSettingsCmd cmd) {
        putIfPresent(SiteSettingsKeys.MAIL_ENABLE, bool(cmd.getMailEnable()));
        putIfPresent(SiteSettingsKeys.MAIL_HOST, cmd.getMailHost());
        putIfPresent(SiteSettingsKeys.MAIL_PORT, cmd.getMailPort());
        putIfPresent(SiteSettingsKeys.MAIL_USERNAME, cmd.getMailUsername());
        putSecret(SiteSettingsKeys.MAIL_PASSWORD, cmd.getMailPassword());
        putIfPresent(SiteSettingsKeys.MAIL_FROM, cmd.getMailFrom());
        putIfPresent(SiteSettingsKeys.MAIL_SSL, bool(cmd.getMailSsl()));
        putIfPresent(SiteSettingsKeys.FRONTEND_DOMAIN, trimSlash(cmd.getFrontendDomain()));
        putIfPresent(SiteSettingsKeys.CORS_ORIGINS, cmd.getCorsOrigins());
        putIfPresent(SiteSettingsKeys.LOCAL_BASE_PATH, cmd.getLocalBasePath());
        putIfPresent(SiteSettingsKeys.LOCAL_BASE_URL, cmd.getLocalBaseUrl());
        putIfPresent(SiteSettingsKeys.TURN_HOST, cmd.getTurnHost());
        putIfPresent(SiteSettingsKeys.TURN_PORT, cmd.getTurnPort());
        putSecret(SiteSettingsKeys.TURN_AUTH_SECRET, cmd.getTurnAuthSecret());
        putIfPresent(SiteSettingsKeys.TURN_TTL, cmd.getTurnTtlSeconds());
        putSecret(SiteSettingsKeys.JWT_SECRET, cmd.getJwtSecret());
        applyLive();
    }

    public SiteSettingsBoxVO exportBox(ExportSiteSettingsCmd cmd) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("v", 1);
            root.put("exportedAt", Instant.now().toString());
            ObjectNode instance = root.putObject("instance");
            Map<String, String> stored = readStored();
            Map<String, String> merged = defaults();
            merged.putAll(stored);
            for (Map.Entry<String, String> e : merged.entrySet()) {
                if (!cmd.isIncludeJwt() && SiteSettingsKeys.JWT_SECRET.equals(e.getKey())) {
                    continue;
                }
                instance.put(e.getKey(), e.getValue() == null ? "" : e.getValue());
            }
            ArrayNode workspaces = root.putArray("workspaces");
            for (SysWorkspace ws : workspaceMapper.selectAll()) {
                ObjectNode n = workspaces.addObject();
                n.put("id", ws.getId());
                n.put("name", ws.getName());
                n.put("localQuotaBytes", ws.getLocalQuotaBytes() == null ? 0L : ws.getLocalQuotaBytes());
            }
            ArrayNode oss = root.putArray("storageSettings");
            if (cmd.isIncludeOss()) {
                for (StorageSetting s : storageSettingMapper.selectAllActive()) {
                    ObjectNode n = oss.addObject();
                    n.put("id", s.getId());
                    n.put("workspaceId", s.getWorkspaceId());
                    n.put("platformIdentifier", s.getPlatformIdentifier());
                    n.put("configData", s.getConfigData());
                    n.put("enabled", s.getEnabled() == null ? 0 : s.getEnabled());
                    n.put("remark", s.getRemark());
                }
            }
            String box = SiteBoxCrypto.seal(cmd.getPassword(), SiteBoxCrypto.utf8(objectMapper.writeValueAsString(root)));
            return new SiteSettingsBoxVO("alder-site.box", box);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("export site settings failed", e);
            throw new BusinessException(ErrorMessages.SITE_BOX_FAILED);
        }
    }

    public void importBox(ImportSiteSettingsCmd cmd) {
        try {
            JsonNode root = objectMapper.readTree(SiteBoxCrypto.utf8(SiteBoxCrypto.open(cmd.getPassword(), cmd.getBox())));
            if (root.path("v").asInt() != 1) {
                throw new BusinessException(ErrorMessages.SITE_BOX_INVALID);
            }
            JsonNode instance = root.path("instance");
            instance.fields().forEachRemaining(e -> {
                if (StringUtils.hasText(e.getKey())) {
                    persist(e.getKey(), e.getValue().asText(""));
                }
            });
            runtime.putAll(readStored());
            applyLive();
            JsonNode oss = root.path("storageSettings");
            if (oss.isArray()) {
                for (JsonNode n : oss) {
                    importStorage(n);
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("import site settings failed", e);
            throw new BusinessException(ErrorMessages.SITE_BOX_INVALID);
        }
    }

    private void importStorage(JsonNode n) {
        String workspaceId = n.path("workspaceId").asText("");
        if (!StringUtils.hasText(workspaceId) || workspaceMapper.selectById(workspaceId) == null) {
            log.warn("skip OSS import, workspace missing: {}", workspaceId);
            return;
        }
        StorageSetting row = new StorageSetting();
        row.setId(n.path("id").asText(null));
        row.setWorkspaceId(workspaceId);
        row.setPlatformIdentifier(n.path("platformIdentifier").asText(""));
        row.setConfigData(n.path("configData").asText("{}"));
        row.setEnabled(n.path("enabled").asInt(0));
        row.setRemark(n.path("remark").asText(""));
        row.setDeleted(0);
        if (StringUtils.hasText(row.getId()) && storageSettingMapper.selectById(row.getId()) != null) {
            storageSettingMapper.updateById(row);
        } else {
            storageSettingMapper.insert(row);
        }
    }

    private void applyLive() {
        applyMail();
        applyLocal();
    }

    private void applyMail() {
        if (!(mailSender instanceof JavaMailSenderImpl impl)) {
            return;
        }
        impl.setHost(runtime.getOrDefault(SiteSettingsKeys.MAIL_HOST, defaultMailHost));
        impl.setPort(runtime.getInt(SiteSettingsKeys.MAIL_PORT, defaultMailPort));
        impl.setUsername(runtime.getOrDefault(SiteSettingsKeys.MAIL_USERNAME, defaultMailUsername));
        impl.setPassword(runtime.getOrDefault(SiteSettingsKeys.MAIL_PASSWORD, defaultMailPassword));
        Properties props = impl.getJavaMailProperties();
        boolean ssl = runtime.getBoolean(SiteSettingsKeys.MAIL_SSL, true);
        props.put("mail.smtp.ssl.enable", String.valueOf(ssl));
        props.put("mail.smtp.auth", "true");
    }

    private void applyLocal() {
        String path = runtime.get(SiteSettingsKeys.LOCAL_BASE_PATH);
        String url = runtime.get(SiteSettingsKeys.LOCAL_BASE_URL);
        if (StringUtils.hasText(path)) {
            localStorage.setBasePath(path);
            File dir = new File(path);
            if (!dir.exists() && !dir.mkdirs()) {
                log.warn("cannot create local storage path {}", path);
            }
        }
        if (StringUtils.hasText(url)) {
            localStorage.setBaseUrl(url);
        }
    }

    private Map<String, String> defaults() {
        Map<String, String> m = new HashMap<>();
        m.put(SiteSettingsKeys.MAIL_ENABLE, String.valueOf(defaultMailEnable));
        m.put(SiteSettingsKeys.MAIL_HOST, defaultMailHost);
        m.put(SiteSettingsKeys.MAIL_PORT, String.valueOf(defaultMailPort));
        m.put(SiteSettingsKeys.MAIL_USERNAME, defaultMailUsername);
        m.put(SiteSettingsKeys.MAIL_PASSWORD, defaultMailPassword);
        m.put(SiteSettingsKeys.MAIL_FROM, defaultMailFrom);
        m.put(SiteSettingsKeys.MAIL_SSL, "true");
        m.put(SiteSettingsKeys.FRONTEND_DOMAIN, defaultFrontend);
        m.put(SiteSettingsKeys.CORS_ORIGINS, defaultCors);
        m.put(SiteSettingsKeys.LOCAL_BASE_PATH, localStorage.getBasePath());
        m.put(SiteSettingsKeys.LOCAL_BASE_URL, localStorage.getBaseUrl());
        m.put(SiteSettingsKeys.TURN_HOST, defaultTurnHost);
        m.put(SiteSettingsKeys.TURN_PORT, defaultTurnPort);
        m.put(SiteSettingsKeys.TURN_AUTH_SECRET, defaultTurnSecret);
        m.put(SiteSettingsKeys.TURN_TTL, defaultTurnTtl);
        m.put(SiteSettingsKeys.JWT_SECRET, defaultJwt);
        return m;
    }

    private Map<String, String> readStored() {
        Map<String, String> m = new HashMap<>();
        try {
            for (Map<String, Object> row : siteSettingsMapper.selectAll()) {
                Object k = row.get("setting_key");
                if (k == null) {
                    k = row.get("settingKey");
                }
                Object v = row.get("setting_value");
                if (v == null) {
                    v = row.get("settingValue");
                }
                if (k != null && v != null) {
                    m.put(String.valueOf(k), String.valueOf(v));
                }
            }
        } catch (Exception e) {
            log.warn("site_settings not ready: {}", e.getMessage());
        }
        return m;
    }

    private void putIfPresent(String key, String value) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return;
        }
        persist(key, trimmed);
    }

    private void putSecret(String key, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        persist(key, value);
    }

    private void persist(String key, String value) {
        siteSettingsMapper.upsert(key, value);
        runtime.put(key, value);
    }

    private static String bool(Boolean v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String trimSlash(String url) {
        if (url == null) {
            return null;
        }
        String t = url.trim();
        while (t.endsWith("/")) {
            t = t.substring(0, t.length() - 1);
        }
        return t;
    }

    private static String maskJdbc(String url) {
        if (!StringUtils.hasText(url)) {
            return "";
        }
        return url.replaceAll("password=[^&]*", "password=***");
    }
}
