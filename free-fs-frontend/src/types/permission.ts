/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export const PermissionCode = {
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_SHARE: 'file:share',
  STORAGE_MANAGE: 'storage:manage',
  MEMBER_MANAGE: 'member:manage',
  LOG_READ: 'log:read',
} as const

export type PermissionCodeType =
  (typeof PermissionCode)[keyof typeof PermissionCode]

/** GET `/apis/permission/list` 单项 */
export interface PermissionDef {
  id: number
  permissionCode: PermissionCodeType
  permissionName: string
  module: string
  desc?: string | null
  sort?: number
}

export interface PageResult<T> {
  total: number
  records: T[]
}
