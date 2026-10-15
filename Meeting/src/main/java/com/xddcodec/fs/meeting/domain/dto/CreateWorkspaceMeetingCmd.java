/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.domain.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateWorkspaceMeetingCmd {
    private String title;
    /** ISO-8601，例如 2026-09-23T15:00:00+08:00 */
    private String startsAt;
    private List<String> participantUserIds;
}
