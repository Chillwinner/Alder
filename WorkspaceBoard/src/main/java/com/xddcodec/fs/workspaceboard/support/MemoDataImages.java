/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.support;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

/** 预览时把 md 内 data URL 拆成占位 + 二进制，正文文件仍保持嵌入。 */
public final class MemoDataImages {

    public record Image(String mime, byte[] bytes) {
    }

    public record Extract(String liteMd, List<Image> images) {
    }

    private MemoDataImages() {
    }

    /**
     * 编辑器保存的是 {@code alder-inline:n}。按磁盘上原来的 data URL 序号写回去，避免把内嵌图存成占位符。
     */
    public static String restoreInlinePlaceholders(String incoming, String previous) {
        if (incoming == null || !incoming.contains("alder-inline:")) {
            return incoming;
        }
        List<String> srcs = dataSrcs(previous);
        if (srcs.isEmpty()) {
            return incoming;
        }
        StringBuilder out = new StringBuilder(incoming.length() + 256);
        int i = 0;
        while (i < incoming.length()) {
            int mark = incoming.indexOf("](alder-inline:", i);
            if (mark < 0) {
                out.append(incoming, i, incoming.length());
                break;
            }
            int tokenStart = mark + 2;
            int close = incoming.indexOf(')', tokenStart);
            if (close < 0) {
                out.append(incoming, i, incoming.length());
                break;
            }
            out.append(incoming, i, tokenStart);
            int index = parseIndex(incoming.substring(tokenStart, close));
            if (index >= 0 && index < srcs.size()) {
                out.append(srcs.get(index));
            } else {
                out.append(incoming, tokenStart, close);
            }
            i = close;
        }
        return out.toString();
    }

    /** 只替换占位，不解码。打开编辑器时不能为了正文把每张图都解出来。 */
    public static String lite(String markdown) {
        String md = markdown == null ? "" : markdown;
        if (!md.contains("](data:")) {
            return md;
        }
        StringBuilder out = new StringBuilder(Math.min(md.length(), 8192));
        int index = 0;
        int i = 0;
        while (i < md.length()) {
            int[] span = nextDataImage(md, i);
            if (span == null) {
                out.append(md, i, md.length());
                break;
            }
            int bang = span[0];
            int data = span[1];
            int close = span[2];
            out.append(md, i, bang);
            out.append("![").append(md, bang + 2, data).append("](alder-inline:").append(index).append(")");
            index += 1;
            i = close + 1;
        }
        return out.toString();
    }

    public static Image imageAt(String markdown, int index) {
        if (index < 0 || markdown == null) {
            return null;
        }
        int seen = 0;
        int i = 0;
        while (i < markdown.length()) {
            int[] span = nextDataImage(markdown, i);
            if (span == null) {
                return null;
            }
            int close = span[2];
            if (seen == index) {
                int comma = span[3];
                try {
                    byte[] bytes = Base64.getDecoder().decode(
                            stripWs(markdown, comma + 1, close).getBytes(StandardCharsets.US_ASCII));
                    return new Image(sniffMime(mimeFrom(markdown.substring(span[1] + 2, comma)), bytes), bytes);
                } catch (RuntimeException ignored) {
                    return null;
                }
            }
            seen += 1;
            i = close + 1;
        }
        return null;
    }

    /** @return bang, data, close, comma；没有则 null */
    private static int[] nextDataImage(String md, int from) {
        int i = from;
        while (i < md.length()) {
            int data = md.indexOf("](data:", i);
            if (data < 0) {
                return null;
            }
            int bang = md.lastIndexOf("![", data);
            int payload = data + 2;
            int comma = md.indexOf(',', payload);
            int close = comma < 0 ? -1 : md.indexOf(')', comma);
            if (bang < i || close < 0) {
                i = data + 2;
                continue;
            }
            int nl = md.indexOf('\n', bang);
            if (nl >= 0 && nl < data) {
                i = data + 2;
                continue;
            }
            return new int[] { bang, data, close, comma };
        }
        return null;
    }

    public static Extract extract(String markdown) {
        String md = markdown == null ? "" : markdown;
        if (!md.contains("](data:")) {
            return new Extract(md, List.of());
        }
        StringBuilder out = new StringBuilder(Math.min(md.length(), 8192));
        List<Image> images = new ArrayList<>();
        int i = 0;
        while (i < md.length()) {
            int data = md.indexOf("](data:", i);
            if (data < 0) {
                out.append(md, i, md.length());
                break;
            }
            int bang = md.lastIndexOf("![", data);
            if (bang < i) {
                out.append(md, i, data + 2);
                i = data + 2;
                continue;
            }
            int nl = md.indexOf('\n', bang);
            if (nl >= 0 && nl < data) {
                out.append(md, i, data + 2);
                i = data + 2;
                continue;
            }
            int payload = data + 2;
            int comma = md.indexOf(',', payload);
            int close = comma < 0 ? -1 : md.indexOf(')', comma);
            if (comma < 0 || close < 0) {
                out.append(md, i, data + 2);
                i = data + 2;
                continue;
            }
            out.append(md, i, bang);
            String alt = md.substring(bang + 2, data);
            String header = md.substring(payload, comma);
            String b64 = stripWs(md, comma + 1, close);
            try {
                byte[] bytes = Base64.getDecoder().decode(b64.getBytes(StandardCharsets.US_ASCII));
                int index = images.size();
                images.add(new Image(sniffMime(mimeFrom(header), bytes), bytes));
                out.append("![").append(alt).append("](alder-inline:").append(index).append(")");
            } catch (RuntimeException ignored) {
                out.append(md, bang, close + 1);
            }
            i = close + 1;
        }
        return new Extract(out.toString(), images);
    }

    private static List<String> dataSrcs(String markdown) {
        String md = markdown == null ? "" : markdown;
        List<String> srcs = new ArrayList<>();
        int i = 0;
        while (i < md.length()) {
            int data = md.indexOf("](data:", i);
            if (data < 0) {
                break;
            }
            int bang = md.lastIndexOf("![", data);
            int payload = data + 2;
            int comma = md.indexOf(',', payload);
            int close = comma < 0 ? -1 : md.indexOf(')', comma);
            if (bang < i || close < 0) {
                i = data + 2;
                continue;
            }
            int nl = md.indexOf('\n', bang);
            if (nl >= 0 && nl < data) {
                i = data + 2;
                continue;
            }
            try {
                Base64.getDecoder().decode(stripWs(md, comma + 1, close).getBytes(StandardCharsets.US_ASCII));
                srcs.add(md.substring(payload, close));
            } catch (RuntimeException ignored) {
                // 与 extract 一样跳过解不出的图，序号才能对上
            }
            i = close + 1;
        }
        return srcs;
    }

    private static int parseIndex(String token) {
        String prefix = "alder-inline:";
        if (!token.startsWith(prefix)) {
            return -1;
        }
        try {
            return Integer.parseInt(token.substring(prefix.length()).trim());
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    private static String sniffMime(String declared, byte[] bytes) {
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4e
                && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8) {
            return "image/jpeg";
        }
        if (bytes.length >= 6 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') {
            return "image/gif";
        }
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F') {
            return "image/webp";
        }
        return declared;
    }

    private static String mimeFrom(String header) {
        String raw = header.startsWith("data:") ? header.substring(5) : header;
        int semi = raw.indexOf(';');
        String mime = (semi < 0 ? raw : raw.substring(0, semi)).trim().toLowerCase(Locale.ROOT);
        return mime.startsWith("image/") ? mime : "image/png";
    }

    private static String stripWs(String md, int from, int to) {
        StringBuilder b64 = new StringBuilder(to - from);
        for (int i = from; i < to; i++) {
            char c = md.charAt(i);
            if (c > ' ') {
                b64.append(c);
            }
        }
        return b64.toString();
    }
}
