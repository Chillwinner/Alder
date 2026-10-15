/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.meeting.schedule;

import com.xddcodec.fs.meeting.service.WorkspaceMeetingService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WorkspaceMeetingScheduler {

    private final WorkspaceMeetingService meetingService;

    @Scheduled(fixedDelay = 60_000)
    public void pre15Reminders() {
        meetingService.pushDuePre15();
    }
}
