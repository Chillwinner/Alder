/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.support;

public final class ProgressConstants {

    public static final String KIND_DAILY = "DAILY";
    public static final String KIND_NORMAL = "NORMAL";

    public static final String STATUS_TODO = "TODO";
    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_BLOCKED = "BLOCKED";
    public static final String STATUS_REVIEW = "REVIEW";
    public static final String STATUS_DONE = "DONE";

    public static final String REVIEW_NONE = "NONE";
    public static final String REVIEW_PENDING = "PENDING";
    public static final String REVIEW_APPROVED = "APPROVED";
    public static final String REVIEW_REJECTED = "REJECTED";

    private ProgressConstants() {
    }
}
