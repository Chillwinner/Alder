/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.fsadmin;

import com.xddcodec.fs.common.utils.Ip2RegionUtils;
import com.xddcodec.fs.common.utils.IpUtils;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class FsAdminApplicationTests {

    @Test
    void contextLoads() throws Exception {
        System.out.println(Ip2RegionUtils.search("172.22.166.15"));
    }

}
