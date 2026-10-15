/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.common.utils;

/**
 * 把存储 SDK 的技术错误收成稳定 key，文案由前端翻译。
 */
public class ErrorMessageUtils {

    public static String extractUserFriendlyMessage(String message) {
        if (message == null) {
            return "error";
        }
        if (message.contains("Connection refused") || message.contains("connect timed out")) {
            return "storage.connect.refused";
        }
        if (message.contains("timeout") || message.contains("timed out")) {
            return "storage.connect.timeout";
        }
        if (message.contains("403") || message.contains("Forbidden")
                || message.contains("Access Denied") || message.contains("InvalidAccessKeyId")
                || message.contains("401") || message.contains("Unauthorized")) {
            return "storage.auth.failed";
        }
        if (message.contains("404") || message.contains("Not Found")
                || message.contains("NoSuchBucket") || message.contains("NoSuchKey")) {
            return "storage.resource.not.found";
        }
        if (message.contains("UnknownHostException") || message.contains("No such host")) {
            return "storage.host.unresolved";
        }
        if (message.contains("SSL") || message.contains("certificate")) {
            return "storage.ssl.failed";
        }
        if (looksLikeErrorKey(message)) {
            int colon = message.indexOf(':');
            if (colon > 0 && colon < 80 && looksLikeErrorKey(message.substring(0, colon))) {
                return message.substring(0, colon).trim();
            }
            return message.contains("|") ? message : message.split(":", 2)[0].trim();
        }
        return "error";
    }

    public static String extractUserFriendlyMessage(Exception e) {
        if (e == null) {
            return "error";
        }
        return extractUserFriendlyMessage(e.getMessage());
    }

    private static boolean looksLikeErrorKey(String text) {
        return text != null && text.matches("[a-z][a-z0-9._|-]*");
    }
}
