/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useQuery } from '@tanstack/react-query'
import { StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getWorkspaceBoardOverview } from '@/api/workspace-board'
import type { AiMemoRef } from '@/lib/ai-file-refs'
import type { WorkspaceMemo } from '@/types/workspace-board'

export function AiMemoChip({
  memo,
  onOpen,
}: {
  memo: AiMemoRef
  onOpen: (memo: WorkspaceMemo, origin: DOMRect) => void
}) {
  const { t } = useTranslation(['layout', 'board'])
  const query = useQuery({
    queryKey: ['workspace-board-overview'],
    queryFn: getWorkspaceBoardOverview,
    staleTime: 15_000,
  })
  const resolved =
    query.data?.memos.find((item) => item.id === memo.id) ??
    ({
      id: memo.id,
      workspaceId: '',
      title: memo.title,
    } satisfies WorkspaceMemo)
  const title = resolved.title?.trim() || memo.title || t('board:defaultMemoTitle')

  return (
    <button
      type='button'
      className='a-glass flex w-[220px] max-w-full min-w-0 items-center gap-2.5 rounded-[13px] px-3 py-2 text-left transition-transform duration-150 hover:-translate-y-0.5'
      onClick={(event) => onOpen(resolved, event.currentTarget.getBoundingClientRect())}
    >
      <span className='flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface-secondary text-foreground'>
        <StickyNote className='size-5' strokeWidth={1.6} />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-[12.5px] font-medium' title={title}>
          {title}
        </span>
        <span className='block text-[10.5px] text-text-muted'>{t('ai.openMemo')}</span>
      </span>
    </button>
  )
}
