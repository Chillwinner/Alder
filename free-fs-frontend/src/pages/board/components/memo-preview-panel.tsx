/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getMemoPreviewBody } from '@/api/workspace-board'
import { isCanvasMemo } from '@/lib/memo-canvas'
import { htmlFallbackToMd } from '@/lib/memo-md'
import { MemoCanvasView } from '@/pages/board/components/memo-canvas-view'
import { MemoMarkdownView } from '@/pages/board/components/memo-markdown-view'
import { BoardEmpty } from '@/pages/board/components/board-empty'
import { cn } from '@/lib/utils'
import type { WorkspaceMemo } from '@/types/workspace-board'

type MemoPreviewBodyProps = {
  memoId: string
  visibility?: string
  contentKey?: string
  className?: string
  memo?: Pick<WorkspaceMemo, 'kind'>
}

export function MemoPreviewBody({
  memoId,
  contentKey,
  className,
  memo,
}: MemoPreviewBodyProps) {
  const { t } = useTranslation('board')
  const bodyQuery = useQuery({
    queryKey: ['memo-preview-body', memoId],
    queryFn: () => getMemoPreviewBody(memoId),
    staleTime: 30_000,
  })
  const markdown =
    (bodyQuery.data?.bodyMd || '').trim() || htmlFallbackToMd(bodyQuery.data?.bodyHtml || '')

  if (isCanvasMemo(memo)) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
        <MemoCanvasView memoId={memoId} readOnly className='min-h-[320px]' />
      </div>
    )
  }

  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
      {bodyQuery.isError ? (
        <p className='py-6 text-center text-[13px] text-text-muted'>{t('preview.loadFailed')}</p>
      ) : bodyQuery.isPending && !bodyQuery.data ? (
        <p className='py-6 text-center text-[13px] text-text-muted'>{t('preview.loading')}</p>
      ) : !markdown.trim() ? (
        <BoardEmpty
          icon={<FileText className='size-6' strokeWidth={1.6} />}
          title={t('preview.empty')}
        />
      ) : (
        <MemoMarkdownView
          key={`${memoId}-${contentKey ?? ''}`}
          markdown={markdown}
          memoId={memoId}
          className='px-1 py-2'
        />
      )}
    </div>
  )
}
