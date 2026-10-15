/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.event;

import com.xddcodec.fs.File.domain.dto.CreateFileShareAccessRecordCmd;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.io.Serial;

@Getter
public class CreateFileShareAccessRecordEvent extends ApplicationEvent {

    @Serial
    private static final long serialVersionUID = 1L;

    private final CreateFileShareAccessRecordCmd cmd;

    public CreateFileShareAccessRecordEvent(Object source, CreateFileShareAccessRecordCmd cmd) {
        super(source);
        this.cmd = cmd;
    }
}
