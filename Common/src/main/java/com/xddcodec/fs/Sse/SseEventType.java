/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Sse;

/**
 * SSE事件类型枚举
 * 
 * @author xddcodec
 */
public enum SseEventType {
    
    /**
     * 进度更新事件
     */
    PROGRESS("progress"),
    
    /**
     * 状态变更事件
     */
    STATUS("status"),
    
    /**
     * 任务完成事件
     */
    COMPLETE("complete"),
    
    /**
     * 错误通知事件
     */
    ERROR("error"),

    LAN_PRESENCE("lan_presence");
    
    private final String value;
    
    SseEventType(String value) {
        this.value = value;
    }
    
    public String getValue() {
        return value;
    }
}
