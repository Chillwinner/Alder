/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.domain.vo;

import lombok.Data;

@Data
public class MeetingJoinVO {
    private String meetingId;
    private String roomId;
    private String title;
    private String workspaceName;
    private boolean host;
}
