/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { OperationLogPage, OperationLogQuery } from '@/types/log'
import { request } from './request'

/** 获取当前工作空间的文件及成员操作日志。 */
export function getOperationLogs(params: OperationLogQuery) {
  return request.get<OperationLogPage>('/apis/logs/operation/pages', {
    params,
  })
}
