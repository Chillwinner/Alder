/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef } from 'react'
import { notifyImSync, notifyUnreadTotalRefresh } from '@/components/messages/im-events'
import { useImStore } from '@/store/im'

const ACTIVE_SYNC_MS = 2500
const BACKGROUND_SYNC_MS = 8000

function isChatUiActive() {
  const state = useImStore.getState()
  return state.dialogOpen || state.detachedChats.length > 0
}

function syncIntervalMs() {
  return isChatUiActive() ? ACTIVE_SYNC_MS : BACKGROUND_SYNC_MS
}

export function useImRealtimeSync(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return undefined

    const tick = () => {
      notifyImSync()
      notifyUnreadTotalRefresh()
    }

    const schedule = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(tick, syncIntervalMs())
    }

    tick()
    schedule()

    const unsubscribe = useImStore.subscribe((state, prev) => {
      const active = state.dialogOpen || state.detachedChats.length > 0
      const wasActive = prev.dialogOpen || prev.detachedChats.length > 0
      if (active !== wasActive) {
        schedule()
      }
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      unsubscribe()
    }
  }, [enabled])
}
