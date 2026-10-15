/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 编辑态 /board/:memoId 与列表 /board 视为同一页，避免侧栏和入场动画跟着 URL 抖。 */
export function stabilizeWorkspacePath(path: string) {
  return path
    .replace(/(\/board)\/[^/?#]+/, '$1')
    .replace(/(\/progress)\/(month|mine)/, '$1')
}
