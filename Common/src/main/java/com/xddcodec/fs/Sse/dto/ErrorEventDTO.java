/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Sse.dto;

import lombok.Builder;
import lombok.Data;

/**
 * 错误事件数据传输对象
 * 
 * @author xddcodec
 */
@Data
@Builder
public class ErrorEventDTO {
    
    /**
     * 任务ID
     */
    private String taskId;
    
    /**
     * 错误代码
     */
    private String code;
    
    /**
     * 错误消息
     */
    private String message;
}
