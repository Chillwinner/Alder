/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.auth;

import cn.dev33.satoken.secure.SaSecureUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class PasswordHashService {

    private static final Pattern LEGACY_SHA256 = Pattern.compile("^[0-9a-fA-F]{64}$");
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

    public String encode(String rawPassword) {
        return encoder.encode(forBcrypt(rawPassword));
    }

    public boolean matches(String rawPassword, String encodedPassword) {
        if (encodedPassword == null || encodedPassword.isBlank()) {
            return false;
        }
        if (isLegacyHash(encodedPassword)) {
            return SaSecureUtil.sha256(rawPassword).equalsIgnoreCase(encodedPassword);
        }
        return encoder.matches(forBcrypt(rawPassword), encodedPassword);
    }

    /** BCrypt 只吃前 72 个字符，更长的密码按前缀比对，避免直接报错。 */
    private static String forBcrypt(String rawPassword) {
        if (rawPassword == null || rawPassword.length() <= 72) {
            return rawPassword;
        }
        return rawPassword.substring(0, 72);
    }

    public boolean isLegacyHash(String encodedPassword) {
        return encodedPassword != null && LEGACY_SHA256.matcher(encodedPassword).matches();
    }
}
