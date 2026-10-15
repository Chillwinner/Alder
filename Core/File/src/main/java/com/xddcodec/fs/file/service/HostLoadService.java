/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.file.service;

import com.xddcodec.fs.File.domain.vo.HostLoadVO;
import com.sun.management.OperatingSystemMXBean;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class HostLoadService {

    private final OperatingSystemMXBean os =
            ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);
    private final AtomicReference<Double> cpuSmooth = new AtomicReference<>();

    public HostLoadVO snapshot() {
        double raw = os.getCpuLoad();
        if (raw < 0) {
            raw = os.getProcessCpuLoad();
        }
        double cpu = raw < 0 ? 0 : Math.min(1, raw);
        Double next = cpuSmooth.updateAndGet(
                prev -> prev == null ? cpu : prev * 0.55 + cpu * 0.45);

        long total = os.getTotalMemorySize();
        long free = os.getFreeMemorySize();
        long used = total > free ? total - free : 0;

        HostLoadVO vo = new HostLoadVO();
        vo.setCpu(next == null ? cpu : next);
        vo.setMemory(total > 0 ? Math.min(1, (double) used / total) : 0);
        vo.setMemoryUsedBytes(used);
        vo.setMemoryTotalBytes(total);
        return vo;
    }
}
