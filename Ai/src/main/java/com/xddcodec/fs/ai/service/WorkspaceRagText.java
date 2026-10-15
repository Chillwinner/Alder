/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import org.apache.commons.lang3.StringUtils;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.sax.BodyContentHandler;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class WorkspaceRagText {

    public static final long MAX_BYTES = 20L * 1024 * 1024;
    public static final int MAX_CHARS = 200_000;
    public static final int CHUNK_SIZE = 800;
    public static final int CHUNK_OVERLAP = 120;

    private static final Set<String> SKIP_SUFFIX = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "heic", "tif", "tiff",
            "mp3", "wav", "flac", "aac", "m4a", "ogg", "wma", "opus", "aiff", "amr",
            "mp4", "mov", "avi", "mkv", "webm", "m4v", "flv", "wmv", "mpeg", "mpg", "3gp");

    private WorkspaceRagText() {
    }

    public static boolean skipByName(String displayName) {
        return SKIP_SUFFIX.contains(suffix(displayName));
    }

    public static boolean skipMedia(String displayName, String mimeType) {
        if (skipByName(displayName)) {
            return true;
        }
        if (StringUtils.isBlank(mimeType)) {
            return false;
        }
        String mime = mimeType.toLowerCase(Locale.ROOT);
        return mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/");
    }

    public static String extract(InputStream input) throws Exception {
        BodyContentHandler handler = new BodyContentHandler(-1);
        new AutoDetectParser().parse(input, handler, new Metadata());
        String text = handler.toString();
        if (text == null) {
            return "";
        }
        text = text.replace('\u0000', ' ').trim();
        if (text.length() > MAX_CHARS) {
            return text.substring(0, MAX_CHARS);
        }
        return text;
    }

    public static List<String> chunk(String text) {
        List<String> chunks = new ArrayList<>();
        if (StringUtils.isBlank(text)) {
            return chunks;
        }
        String src = text.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        int i = 0;
        while (i < src.length()) {
            int end = Math.min(src.length(), i + CHUNK_SIZE);
            chunks.add(src.substring(i, end));
            if (end >= src.length()) {
                break;
            }
            i = Math.max(0, end - CHUNK_OVERLAP);
        }
        return chunks;
    }

    private static String suffix(String name) {
        if (name == null) {
            return "";
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}