/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 浏览器能否连上签名地址（桶是否对用户网可达）。
 * 用 no-cors，不依赖桶 CORS；只判断网络通不通。
 */
export async function probeDirectUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  if (!url) {
    return false
  }
  try {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    window.clearTimeout(timer)
    return true
  } catch {
    return false
  }
}
