/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
@MapperScan({
        "com.xddcodec.fs.file.mapper",
        "com.xddcodec.fs.system.mapper",
        "com.xddcodec.fs.log.mapper",
        "com.xddcodec.fs.storage.mapper",
        "com.xddcodec.fs.conversation.mapper",
        "com.xddcodec.fs.lan.mapper",
        "com.xddcodec.fs.progress.mapper",
        "com.xddcodec.fs.workspaceboard.mapper",
        "com.xddcodec.fs.meeting.mapper",
        "com.xddcodec.fs.ai.mapper"
})
public class FsAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(FsAdminApplication.class, args);

        System.out.println("""
                  _____ _    _  _____ _____ ______  _____ _____\s
                 / ____| |  | |/ ____/ ____|  ____|/ ____/ ____|
                | (___ | |  | | |   | |    | |__  | (___| (___ \s
                 \\___ \\| |  | | |   | |    |  __|  \\___ \\\\___ \\\s
                 ____) | |__| | |___| |____| |____ ____) |___) |
                |_____/ \\____/ \\_____\\_____|______|_____/_____/\s
                """);

    }
}
