/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.lan.config;

import com.xddcodec.fs.lan.service.LanTransferService;
import com.xddcodec.fs.sse.SseUserConnectedEvent;
import com.xddcodec.fs.sse.SseUserDisconnectedEvent;
import com.xddcodec.fs.sse.SseUserHeartbeatEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LanPresenceSseListener {

    private final LanTransferService lanTransferService;

    @EventListener
    public void onConnected(SseUserConnectedEvent event) {
        lanTransferService.onSseConnected(event.userId());
    }

    @EventListener
    public void onHeartbeat(SseUserHeartbeatEvent event) {
        lanTransferService.heartbeat(event.userId());
    }

    @EventListener
    public void onDisconnected(SseUserDisconnectedEvent event) {
        lanTransferService.onSseDisconnected(event.userId());
    }
}
