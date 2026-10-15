/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef } from 'react'
import type { MemoMetaEvent } from '@/types/workspace-board'
import { getCurrentWorkspaceId } from '@/store/workspace'

type Options = {
  enabled: boolean
  /** 切换工作空间时重连 SSE */
  workspaceId?: string | null
  onEvent: (event: MemoMetaEvent) => void
}

function buildBoardEventsUrl() {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  )
  const path = '/apis/workspace-board/events'
  const workspaceId = getCurrentWorkspaceId()
  const params = new URLSearchParams()
  if (workspaceId) {
    params.set('X-Workspace-Id', workspaceId)
  }
  const qs = params.toString()
  const prefix = base ? `${base}${path}` : path
  return qs ? `${prefix}?${qs}` : prefix
}

export function useWorkspaceBoardSse({ enabled, workspaceId, onEvent }: Options) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled) return undefined

    const url = buildBoardEventsUrl()
    const source = new EventSource(url, { withCredentials: true })

    const handleMemo = (ev: MessageEvent<string>) => {
      try {
        onEventRef.current(JSON.parse(ev.data) as MemoMetaEvent)
      } catch {
        // ignore malformed payloads
      }
    }

    source.addEventListener('memo', handleMemo)

    return () => {
      source.removeEventListener('memo', handleMemo)
      source.close()
    }
  }, [enabled, workspaceId])
}
