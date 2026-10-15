/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 *
 * Coturn REST / use-auth-secret，与 wbroom TurnCredentialService 相同算法。
 */

package com.xddcodec.fs.meeting.service;

import com.xddcodec.fs.meeting.domain.vo.IceConfigVO;
import com.xddcodec.fs.meeting.domain.vo.IceServerVO;
import com.xddcodec.fs.site.SiteSettingsKeys;
import com.xddcodec.fs.site.SiteSettingsRuntime;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TurnCredentialService {

    private final SiteSettingsRuntime siteSettingsRuntime;

    @Value("${turn.host:}")
    private String host;

    @Value("${turn.port:3478}")
    private int port;

    @Value("${turn.auth-secret:}")
    private String authSecret;

    @Value("${turn.credential-ttl-seconds:86400}")
    private long credentialTtlSeconds;

    @Value("${turn.stun-fallback:stun:stun.l.google.com:19302}")
    private String stunFallback;

    public IceConfigVO buildIceConfig(String identity) {
        List<IceServerVO> servers = new ArrayList<>();
        String liveHost = siteSettingsRuntime.getOrDefault(SiteSettingsKeys.TURN_HOST, host);
        String liveSecret = siteSettingsRuntime.getOrDefault(SiteSettingsKeys.TURN_AUTH_SECRET, authSecret);
        int livePort = siteSettingsRuntime.getInt(SiteSettingsKeys.TURN_PORT, port);
        long ttl = siteSettingsRuntime.getInt(SiteSettingsKeys.TURN_TTL, (int) credentialTtlSeconds);
        if (StringUtils.isBlank(liveHost) || StringUtils.isBlank(liveSecret)) {
            servers.add(new IceServerVO(List.of(stunFallback), null, null));
            return new IceConfigVO(servers);
        }
        long expiry = (System.currentTimeMillis() / 1000L) + ttl;
        String username = expiry + ":" + identity;
        String credential = hmacSha1Base64(liveSecret, username);
        String stun = "stun:" + liveHost + ":" + livePort;
        String turnUdp = "turn:" + liveHost + ":" + livePort + "?transport=udp";
        String turnTcp = "turn:" + liveHost + ":" + livePort + "?transport=tcp";
        servers.add(new IceServerVO(List.of(stun), null, null));
        servers.add(new IceServerVO(List.of(turnUdp, turnTcp), username, credential));
        return new IceConfigVO(servers);
    }

    private static String hmacSha1Base64(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException("生成 TURN 凭证失败", e);
        }
    }
}
