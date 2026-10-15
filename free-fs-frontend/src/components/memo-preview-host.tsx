/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { exportMemoAsMarkdown } from '@/lib/memo-markdown'
import { getCurrentSlug } from '@/store/workspace'
import { useMemoPreviewStore } from '@/store/memo-preview'
import { MemoPreviewDialog } from '@/pages/board/components/memo-preview-dialog'

export function MemoPreviewHost() {
  const memo = useMemoPreviewStore((state) => state.memo)
  const origin = useMemoPreviewStore((state) => state.origin)
  const close = useMemoPreviewStore((state) => state.close)
  const navigate = useNavigate()
  const { slug: routeSlug = '' } = useParams<{ slug: string }>()
  const slug = routeSlug || getCurrentSlug() || ''

  if (!memo) return null

  return (
    <MemoPreviewDialog
      key={memo.id}
      open
      origin={origin}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      memo={memo}
      onEdit={() => {
        close()
        if (slug) navigate(`/w/${slug}/board/${memo.id}`)
      }}
      onExport={() => {
        void exportMemoAsMarkdown(memo)
      }}
    />
  )
}
