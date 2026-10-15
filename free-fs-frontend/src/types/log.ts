/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PageRecord } from './page'

export type OperationLogStatus = 0 | 1

export interface OperationLogItem {
  id: number
  operatorId?: string
  operatorName?: string
  workspaceId: string
  operationType: string
  operationName?: string
  targetType?: string
  targetId?: string
  targetName?: string
  detail?: string
  operationIp?: string
  userAgent?: string
  status: OperationLogStatus
  errorMessage?: string
  operationTime: string
}

export interface OperationLogQuery {
  page: number
  pageSize: number
  keyword?: string
  operationType?: string
  status?: OperationLogStatus
}

export type OperationLogPage = PageRecord<OperationLogItem>
