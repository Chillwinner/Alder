/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.enums;

/**
 * 传输任务状态枚举
 */
public enum TransferTaskStatus {
    /**
     * 初始化
     */
    initialized,
    /**
     * 校验中 - 正在计算MD5
     */
    checking,
    /**
     * 上传中
     */
    uploading,
    /**
     * 合并中
     */
    merging,
    /**
     * 下载中
     */
    downloading,
    /**
     * 失败
     */
    failed,
    /**
     * 已暂停
     */
    paused,
    /**
     * 已完成
     */
    completed,
    /**
     * 已取消
     */
    canceled
}
