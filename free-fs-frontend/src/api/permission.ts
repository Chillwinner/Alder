/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PermissionDef } from '@/types/permission'
import { request } from './request'

export const permissionApi = {
  list: () => {
    return request.get<PermissionDef[]>('/apis/permission/list')
  },
}
