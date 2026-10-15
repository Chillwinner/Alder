/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.storage;

import java.util.List;

/**
 * 可选存储平台。Local 是内置默认，不入库；S3 同步到 storage_platform。
 */
public final class StoragePlatforms {

    public static final String LOCAL = "Local";
    public static final String S3 = "S3";

    private StoragePlatforms() {
    }

    public static Platform s3() {
        return new Platform(
                S3,
                "S3 对象存储",
                "通过 Amazon S3 兼容协议对接对象存储。",
                "icon-bendicunchu1",
                "https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html",
                S3_SCHEMA
        );
    }

    public static List<Platform> remotePlatforms() {
        return List.of(s3());
    }

    public record Platform(
            String identifier,
            String name,
            String description,
            String icon,
            String link,
            String configScheme
    ) {
    }

    private static final String S3_SCHEMA = """
            [
              {"label":"Access-Key","dataType":"string","identifier":"accessKey","validation":{"required":true}},
              {"label":"Secret-key","dataType":"string","identifier":"secretKey","validation":{"required":true}},
              {"label":"服务器端点","dataType":"string","identifier":"endpoint","validation":{"required":true}},
              {"label":"存储桶名","dataType":"string","identifier":"bucket","validation":{"required":true}},
              {"label":"区域（可选，默认 us-east-1）","dataType":"string","identifier":"region","validation":{"required":false}},
              {"label":"自定义域名（可选）","dataType":"string","identifier":"customDomain","validation":{"required":false}}
            ]
            """;
}
