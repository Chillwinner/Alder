/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.VirtualThreadTaskExecutor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler;

@Configuration(proxyBeanMethods = false)
@EnableAsync
@EnableScheduling
public class AsyncConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        SimpleAsyncTaskScheduler scheduler = new SimpleAsyncTaskScheduler();
        scheduler.setThreadNamePrefix("scheduler-virtual-");
        scheduler.setVirtualThreads(true);
        return scheduler;
    }

    @Bean("chunkUploadExecutor")
    public TaskExecutor chunkUploadExecutor() {
        return new VirtualThreadTaskExecutor("chunk-upload-virtual-");
    }

    @Bean("fileMergeExecutor")
    public TaskExecutor fileMergeExecutor() {
        return new VirtualThreadTaskExecutor("file-merge-virtual-");
    }
}
