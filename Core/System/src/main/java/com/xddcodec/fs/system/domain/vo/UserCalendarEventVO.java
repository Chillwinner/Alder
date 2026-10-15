/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.domain.vo;

import lombok.Data;

@Data
public class UserCalendarEventVO {
    private String id;
    private String title;
    private String note;
    private String startsAt;
    private String endsAt;
}
