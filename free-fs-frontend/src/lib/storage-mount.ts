/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 工作区本地存储挂载根，对应后端 StorageMountService.LOCAL */
export const LOCAL_MOUNT_ID = 'mnt:local'

export function isLocalMountId(id?: string | null) {
  return id === LOCAL_MOUNT_ID
}
