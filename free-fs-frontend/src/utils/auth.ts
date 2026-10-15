/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

const AUTH_SESSION_KEY = 'authSession'

/**
 * 仅保存非敏感的登录状态标记。真正的认证凭据由后端写入 HttpOnly Cookie，
 * 前端 JavaScript 无法读取，从而降低 XSS 窃取令牌的风险。
 */
export const setAuthSession = (remember: boolean = false): void => {
  // 新登录会话不能继承旧账号留下的文件复制剪贴板。
  localStorage.removeItem('free-fs-file-copy-clipboard')
  if (remember) {
    localStorage.setItem(AUTH_SESSION_KEY, '1')
    sessionStorage.removeItem(AUTH_SESSION_KEY)
  } else {
    sessionStorage.setItem(AUTH_SESSION_KEY, '1')
    localStorage.removeItem(AUTH_SESSION_KEY)
  }
}

export const clearAuthSession = (): void => {
  localStorage.removeItem(AUTH_SESSION_KEY)
  sessionStorage.removeItem(AUTH_SESSION_KEY)
  // 文件复制剪贴板属于当前登录会话，退出后不能带给下一个账号。
  localStorage.removeItem('free-fs-file-copy-clipboard')
  // 清理旧版本曾保存的明文令牌。
  localStorage.removeItem('accessToken')
  sessionStorage.removeItem('accessToken')
}

export const hasAuthSession = (): boolean => {
  // 升级到 Cookie 认证后，不再保留旧版本的 Bearer Token。
  localStorage.removeItem('accessToken')
  sessionStorage.removeItem('accessToken')
  return (
    localStorage.getItem(AUTH_SESSION_KEY) === '1' ||
    sessionStorage.getItem(AUTH_SESSION_KEY) === '1'
  )
}
