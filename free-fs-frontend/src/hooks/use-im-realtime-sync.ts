/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef } from 'react'
import { notifyImSync, notifyUnreadTotalRefresh } from '@/components/messages/im-events'

/** 连接正常时只做慢速补拉，防止偶发丢推送。 */
const CONNECTED_FALLBACK_MS = 45_000
/** 套接字断开时才加快轮询，直到 onConnect 再把间隔拉长。 */
const DISCONNECTED_SYNC_MS = 8_000

/**
 * 聊天以 WebSocket 推送为主。这里只在断线时补拉，在线时用长间隔兜底。
 */
export function useImRealtimeSync(enabled: boolean) {
  const connectedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return undefined

    const tick = () => {
      notifyImSync()
      notifyUnreadTotalRefresh()
    }

    const schedule = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      const interval = connectedRef.current ? CONNECTED_FALLBACK_MS : DISCONNECTED_SYNC_MS
      timerRef.current = setInterval(tick, interval)
    }

    const onConnected = () => {
      connectedRef.current = true
      schedule()
    }

    const onDisconnected = () => {
      connectedRef.current = false
      tick()
      schedule()
    }

    connectedRef.current = false
    tick()
    schedule()
    window.addEventListener('im:connected', onConnected)
    window.addEventListener('im:disconnected', onDisconnected)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      window.removeEventListener('im:connected', onConnected)
      window.removeEventListener('im:disconnected', onDisconnected)
    }
  }, [enabled])
}
