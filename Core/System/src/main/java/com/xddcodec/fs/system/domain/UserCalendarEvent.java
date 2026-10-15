/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.domain;

import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class UserCalendarEvent {
    private String id;
    private String userId;
    private String title;
    private String note;
    private OffsetDateTime startsAt;
    private OffsetDateTime endsAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
