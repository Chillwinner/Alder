/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { MemoMetaEvent } from '@/types/workspace-board'
import { useWorkspaceBoardSse } from '@/hooks/use-workspace-board-sse'
import { consumeOwnMemoEvent } from '@/lib/memo-editor-flush'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspaceStore } from '@/store/workspace'

/**
 * 工作空间内任意页面订阅协作页元数据 SSE，刷新备忘录列表（协作页 / 首页等共用 query）。
 */
export function WorkspaceBoardMetaSseSync() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const slug = useWorkspaceStore((s) => {
    if (!s.currentWorkspaceId) return null
    return s.workspaces.find((w) => w.id === s.currentWorkspaceId)?.slug ?? null
  })

  const onEvent = useCallback(
    (event: MemoMetaEvent) => {
      if (!slug) return
      void queryClient.invalidateQueries({
        queryKey: ['workspace-board', slug],
        refetchType: 'active',
      })
      if (!event.memoId || event.event === 'deleted') return
      void queryClient.invalidateQueries({
        queryKey: ['memo-preview-body', event.memoId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['memo-canvas', event.memoId],
      })
      const mine = Boolean(user?.id && event.actorId && event.actorId === user.id)
      if (mine || (!event.actorId && consumeOwnMemoEvent(event.memoId))) return
      window.dispatchEvent(
        new CustomEvent('alder:memo-server-changed', {
          detail: { memoId: event.memoId, event: event.event },
        })
      )
    },
    [queryClient, slug, user?.id]
  )

  useWorkspaceBoardSse({
    enabled: Boolean(workspaceId && slug),
    workspaceId,
    onEvent,
  })

  return null
}
