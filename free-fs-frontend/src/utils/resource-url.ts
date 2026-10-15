/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getCurrentWorkspaceId } from '@/store/workspace'

function getCurrentStoragePlatformId(): string | null {
  const storageInfo = localStorage.getItem('current-storage-platform')
  if (!storageInfo) return null
  try {
    const platform = JSON.parse(storageInfo)
    return platform?.settingId || null
  } catch {
    return null
  }
}

/**
 * 解析后端返回的资源 URL，供 img、a 等浏览器原生请求使用。
 * axios 可带自定义 Header；img 标签不行，需通过 query 传递工作空间等上下文。
 */
export function resolveResourceUrl(url: string | undefined | null): string {
  if (!url) return ''

  let resolved = url.trim()
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  const wasRelative = resolved.startsWith('/')

  // 生产环境若后端返回绝对 API 地址，转为同源相对路径（避免 CSP img-src 'self' 拦截）
  if (!apiBase && /^https?:\/\//i.test(resolved)) {
    try {
      const parsed = new URL(resolved)
      if (parsed.pathname.startsWith('/apis/')) {
        resolved = `${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    } catch {
      // keep original
    }
  }

  // 开发环境：相对路径补全 API base，确保 img 与 axios 同源以携带 Cookie
  if (resolved.startsWith('/') && apiBase) {
    resolved = `${apiBase}${resolved}`
  }

  try {
    const parsed = new URL(resolved, window.location.origin)

    const workspaceId = getCurrentWorkspaceId()
    if (workspaceId && !parsed.searchParams.has('X-Workspace-Id')) {
      parsed.searchParams.set('X-Workspace-Id', workspaceId)
    }

    const platformId = getCurrentStoragePlatformId()
    if (
      platformId &&
      !parsed.searchParams.has('X-Storage-Platform-Config-Id')
    ) {
      parsed.searchParams.set('X-Storage-Platform-Config-Id', platformId)
    }

    if (wasRelative && !apiBase) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    return parsed.href
  } catch {
    return resolved
  }
}
