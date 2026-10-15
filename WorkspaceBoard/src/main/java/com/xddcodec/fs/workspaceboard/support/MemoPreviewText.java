/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.support;

import java.util.regex.Pattern;

/** 列表/探测用短摘要：丢掉 data URL，避免把整篇正文拉到前端。 */
public final class MemoPreviewText {

    private static final Pattern DATA_IMAGE =
            Pattern.compile("!\\[[^\\]]*\\]\\(data:image\\/[^)]+\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MD_IMAGE = Pattern.compile("!\\[[^\\]]*\\]\\([^)]+\\)");
    private static final Pattern MD_LINK = Pattern.compile("\\[([^\\]]+)\\]\\([^)]+\\)");
    private static final Pattern MARKS = Pattern.compile("[#>*`_~\\[\\]()]+");

    private MemoPreviewText() {
    }

    public static String snippet(String raw, int max) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String text = DATA_IMAGE.matcher(raw).replaceAll(" ");
        text = MD_IMAGE.matcher(text).replaceAll(" ");
        text = MD_LINK.matcher(text).replaceAll("$1");
        text = MARKS.matcher(text).replaceAll(" ");
        text = text.replaceAll("\\s+", " ").trim();
        if (text.length() <= max) {
            return text;
        }
        return text.substring(0, max);
    }
}
