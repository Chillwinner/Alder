/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 分页结果集（通常作为 HttpResponse.data，与 Spring 等 Page 结构一致）
 */
export interface PageRecord<T> {
  records: T[]
  total: number
}

/**
 * 若业务层单独包装 code + data，可再套一层（当前分享分页接口直接返回 PageRecord）
 */
export interface PageResult<T> {
  code: number
  data: PageRecord<T>
}
