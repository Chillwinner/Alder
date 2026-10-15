/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 登录成功后规范化 redirect，避免回到带 memoId 的协作页时自动弹出编辑窗 */
export function normalizeRedirectAfterLogin(path: string): string {
  const boardMemo = path.match(/^(\/w\/[^/]+\/board)\/[^/?#]+(\?[^#]*)?(#.*)?$/)
  if (boardMemo) {
    return boardMemo[1] + (boardMemo[2] ?? '') + (boardMemo[3] ?? '')
  }
  return path
}

export function getSafeRedirectPath(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get('redirect')
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
    return normalizeRedirectAfterLogin(decoded)
  } catch {
    return null
  }
}
