/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.support;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 从 Yjs / y-prosemirror 快照里抽出正文、链接和嵌入文件，丢掉 schema 噪声。 */
public final class YjsPlainText {

    public static final class Extract {
        public final String text;
        public final List<String> links;
        public final List<Map<String, String>> files;

        Extract(String text, List<String> links, List<Map<String, String>> files) {
            this.text = text;
            this.links = links;
            this.files = files;
        }
    }

    private static final Set<String> NOISE = Set.of(
            "prosemirror", "default", "paragraph", "heading", "bulletlist", "orderedlist",
            "listitem", "blockquote", "codeblock", "horizontalrule", "hardbreak",
            "textstyle", "underline", "italic", "bold", "strike", "link", "image",
            "memoworkspacefile", "collaboration", "type", "attrs", "content", "text",
            "doc", "fileid", "src", "href", "align", "fontsize", "true", "false", "null",
            "left", "right", "center", "target", "blank", "rel", "noopener", "noreferrer",
            "nofollow", "class", "width", "height", "size", "suffix", "mime", "isdir",
            "png", "jpg", "jpeg", "gif", "webp", "svg", "name", "alt", "image/png",
            "image/jpeg", "text-primary", "underline-offset-2");

    private static final Pattern URL = Pattern.compile("https?://[a-zA-Z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]+");
    private static final Pattern FILE_API = Pattern.compile("/apis/file/([a-fA-F0-9]{16,40})/content");
    private static final Pattern FILE_ID = Pattern.compile("(?<![a-fA-F0-9])([a-fA-F0-9]{32})(?![a-fA-F0-9])");
    private static final Pattern NAMED_FILE = Pattern.compile(
            "(?:namew|altw|\"name\": \"|\"name\":\"|\"alt\": \"|\"alt\":\")([^\"\\x00]{1,240}?\\.(?:png|jpe?g|gif|webp|svg|bmp|pdf|docx?|xlsx?|pptx?|txt|csv|zip|mp4))",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern HAN = Pattern.compile("[\\p{IsHan}]{1,80}");
    private static final Pattern CAMEL = Pattern.compile("^[a-z]+(?:[A-Z][a-zA-Z0-9]+)+$");

    private YjsPlainText() {
    }

    public static String extract(byte[] data) {
        return parse(data).text;
    }

    public static Extract ofPlain(String text) {
        return new Extract(text == null ? "" : text, List.of(), List.of());
    }

    public static Extract parse(byte[] data) {
        if (data == null || data.length == 0) {
            return new Extract("", List.of(), List.of());
        }
        String raw = new String(data, StandardCharsets.UTF_8);

        LinkedHashSet<String> links = new LinkedHashSet<>();
        Matcher url = URL.matcher(raw);
        while (url.find()) {
            String href = url.group().replaceAll("[,.;)]+$", "");
            if (href.startsWith("http")) {
                links.add(href);
            }
        }

        Map<String, String> fileNames = new LinkedHashMap<>();
        Matcher named = NAMED_FILE.matcher(raw);
        while (named.find()) {
            String name = named.group(1).trim();
            if (!name.isEmpty()) {
                fileNames.putIfAbsent(name, "");
            }
        }
        Matcher api = FILE_API.matcher(raw);
        List<String> ids = new ArrayList<>();
        while (api.find()) {
            ids.add(api.group(1));
        }
        Matcher hex = FILE_ID.matcher(raw);
        while (hex.find()) {
            String id = hex.group(1);
            if (!ids.contains(id)) {
                ids.add(id);
            }
        }
        List<Map<String, String>> files = new ArrayList<>();
        List<String> nameList = new ArrayList<>(fileNames.keySet());
        int n = Math.max(ids.size(), nameList.size());
        for (int i = 0; i < n; i++) {
            Map<String, String> row = new LinkedHashMap<>();
            if (i < ids.size()) {
                row.put("id", ids.get(i));
            }
            if (i < nameList.size()) {
                row.put("displayName", nameList.get(i));
            }
            if (!row.isEmpty()) {
                files.add(row);
            }
        }

        LinkedHashSet<String> texts = new LinkedHashSet<>();
        Matcher han = HAN.matcher(raw);
        while (han.find()) {
            texts.add(han.group());
        }
        for (String run : utf8Runs(data)) {
            if (keepText(run, links, nameList)) {
                texts.add(run);
            }
        }

        return new Extract(String.join(" ", texts).replaceAll("\\s+", " ").trim(), List.copyOf(links), files);
    }

    private static List<String> utf8Runs(byte[] data) {
        List<String> parts = new ArrayList<>();
        int i = 0;
        while (i < data.length) {
            int[] read = nextRun(data, i);
            if (read == null) {
                i++;
                continue;
            }
            parts.add(new String(data, read[0], read[1] - read[0], StandardCharsets.UTF_8).trim());
            i = read[1];
        }
        return parts;
    }

    private static boolean keepText(String piece, Set<String> links, List<String> fileNames) {
        if (piece.length() < 1 || piece.length() > 80) {
            return false;
        }
        String compact = piece.toLowerCase(Locale.ROOT).replace(" ", "");
        if (NOISE.contains(compact) || compact.startsWith("image/") || compact.contains("underline-offset")) {
            return false;
        }
        if (CAMEL.matcher(piece).matches()) {
            return false;
        }
        if (piece.startsWith("http") || piece.contains("/apis/file/")) {
            return false;
        }
        for (String name : fileNames) {
            if (name.contains(piece) || piece.contains(name)) {
                return false;
            }
        }
        for (String link : links) {
            if (link.contains(piece)) {
                return false;
            }
        }
        if (piece.matches("[a-fA-F0-9]{16,}")) {
            return false;
        }
        boolean han = piece.codePoints().anyMatch(cp -> cp >= 0x4E00);
        boolean word = piece.matches("[A-Za-z0-9._-]{2,24}");
        return han || word;
    }

    private static int[] nextRun(byte[] data, int from) {
        int i = from;
        while (i < data.length) {
            int[] cp = decode(data, i);
            if (cp != null && useful(cp[0])) {
                break;
            }
            i += cp == null ? 1 : cp[1];
        }
        if (i >= data.length) {
            return null;
        }
        int start = i;
        while (i < data.length) {
            int[] cp = decode(data, i);
            if (cp == null || !useful(cp[0])) {
                break;
            }
            i += cp[1];
        }
        return i > start ? new int[]{start, i} : null;
    }

    private static boolean useful(int cp) {
        return Character.isLetterOrDigit(cp)
                || Character.isIdeographic(cp)
                || cp == '.' || cp == '_' || cp == '-';
    }

    private static int[] decode(byte[] data, int i) {
        int b = data[i] & 0xff;
        if (b < 0x80) {
            return new int[]{b, 1};
        }
        if (b >= 0xc2 && b <= 0xdf && i + 1 < data.length) {
            int b2 = data[i + 1] & 0xff;
            if ((b2 & 0xc0) == 0x80) {
                return new int[]{((b & 0x1f) << 6) | (b2 & 0x3f), 2};
            }
        }
        if (b >= 0xe0 && b <= 0xef && i + 2 < data.length) {
            int b2 = data[i + 1] & 0xff;
            int b3 = data[i + 2] & 0xff;
            if ((b2 & 0xc0) == 0x80 && (b3 & 0xc0) == 0x80) {
                return new int[]{((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f), 3};
            }
        }
        return null;
    }
}
