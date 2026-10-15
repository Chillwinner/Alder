/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.support;

public final class LanConstants {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_ACCEPTED = "ACCEPTED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_DONE = "DONE";

    public static final String EVENT_INVITE = "INVITE";
    public static final String EVENT_ACCEPTED = "ACCEPTED";
    public static final String EVENT_REJECTED = "REJECTED";
    public static final String EVENT_CANCELLED = "CANCELLED";
    public static final String EVENT_SIGNAL = "SIGNAL";
    public static final String EVENT_FAILED = "FAILED";
    public static final String EVENT_DONE = "DONE";

    public static final String PRESENCE_KEY = "lan:presence:";
    public static final long PRESENCE_TTL_SECONDS = 45;

    public static final int MAX_FILES = 200;

    private LanConstants() {
    }
}
