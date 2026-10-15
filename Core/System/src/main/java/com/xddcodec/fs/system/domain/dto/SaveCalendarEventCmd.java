/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.domain.dto;

import lombok.Data;

@Data
public class SaveCalendarEventCmd {
    private String title;
    private String note;
    private String startsAt;
    private String endsAt;
}
