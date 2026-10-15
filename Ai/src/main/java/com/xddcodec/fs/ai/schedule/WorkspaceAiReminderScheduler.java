/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.schedule;

import com.xddcodec.fs.ai.service.WorkspaceAiReminderService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WorkspaceAiReminderScheduler {

    private final WorkspaceAiReminderService reminderService;

    @Scheduled(fixedDelay = 20_000)
    public void fireDue() {
        reminderService.fireDue();
    }
}