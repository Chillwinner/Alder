/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.File.domain.vo;

/**
 * 删除文件收集时返回给管理端的删除统计。
 *
 * <p>该结果只用于服务层和操作日志，不会把删除统计作为接口响应返回。</p>
 */
public record FileCollectionDeletionResult(
        FileCollectionVO collection,
        int submissionCount,
        int terminalTaskCount) {
}
