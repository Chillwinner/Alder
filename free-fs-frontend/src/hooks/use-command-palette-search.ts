/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFileList } from '@/api/file'
import { fetchImInbox } from '@/api/im'
import { getWorkspaceBoardOverview } from '@/api/workspace-board'
import type { FileItem } from '@/types/file'
import type { ImInboxItem } from '@/types/im'
import type { WorkspaceMemo } from '@/types/workspace-board'

function inboxLabel(item: ImInboxItem) {
  if (item.convType === 'group') return item.groupName || ''
  return item.peerNickname || item.peerUsername || ''
}

export function useCommandPaletteSearch(keyword: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(keyword)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword.trim()), 220)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const q = debounced
  const active = enabled && q.length > 0

  const files = useQuery({
    queryKey: ['palette-files', q],
    queryFn: () => getFileList({ keyword: q, page: 1, pageSize: 6 }),
    enabled: active,
    staleTime: 8_000,
  })

  const board = useQuery({
    queryKey: ['palette-board'],
    queryFn: getWorkspaceBoardOverview,
    enabled: active,
    staleTime: 30_000,
  })

  const inbox = useQuery({
    queryKey: ['palette-inbox'],
    queryFn: fetchImInbox,
    enabled: active,
    staleTime: 15_000,
  })

  const lower = q.toLowerCase()
  const fileHits: FileItem[] = files.data?.records ?? []
  const memoHits: WorkspaceMemo[] = (board.data?.memos ?? []).filter((memo) =>
    (memo.title || '').toLowerCase().includes(lower)
  ).slice(0, 6)
  const chatHits: ImInboxItem[] = (inbox.data ?? [])
    .filter((item) => {
      const label = inboxLabel(item).toLowerCase()
      const last = (item.lastContent || '').toLowerCase()
      return label.includes(lower) || last.includes(lower)
    })
    .slice(0, 6)

  return {
    query: q,
    fileHits,
    memoHits,
    chatHits,
    inboxLabel,
    pending: active && (files.isFetching || board.isFetching || inbox.isFetching),
  }
}
