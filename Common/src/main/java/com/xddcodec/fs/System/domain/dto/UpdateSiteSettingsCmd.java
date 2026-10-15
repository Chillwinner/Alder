package com.xddcodec.fs.System.domain.dto;

import lombok.Data;

@Data
public class UpdateSiteSettingsCmd {

    private Boolean mailEnable;
    private String mailHost;
    private String mailPort;
    private String mailUsername;
    private String mailPassword;
    private String mailFrom;
    private Boolean mailSsl;
    private String frontendDomain;
    private String corsOrigins;
    private String localBasePath;
    private String localBaseUrl;
    private String turnHost;
    private String turnPort;
    private String turnAuthSecret;
    private String turnTtlSeconds;
    private String jwtSecret;
}
