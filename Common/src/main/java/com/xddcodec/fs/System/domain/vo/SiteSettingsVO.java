package com.xddcodec.fs.System.domain.vo;

import lombok.Data;

@Data
public class SiteSettingsVO {

    private boolean mailEnable;
    private String mailHost;
    private String mailPort;
    private String mailUsername;
    private boolean mailPasswordSet;
    private String mailFrom;
    private boolean mailSsl;
    private String frontendDomain;
    private String corsOrigins;
    private String localBasePath;
    private String localBaseUrl;
    private String turnHost;
    private String turnPort;
    private boolean turnSecretSet;
    private String turnTtlSeconds;
    private boolean jwtSecretSet;
    private boolean jwtNeedsRestart;
    private String postgresHint;
    private String redisHint;
}
