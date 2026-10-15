/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { htmlFallbackToMd, stripMemoExportRefs } from '@/lib/memo-md'
import { hydrateDataImagesForPreview } from '@/lib/md-data-images'
import { MemoMarkdownView } from '@/pages/board/components/memo-markdown-view'

type MarkdownPreviewProps = {
  blob: Blob
  title: string
}

export function MarkdownPreview({ blob, title }: MarkdownPreviewProps) {
  const { t } = useTranslation('common')
  const [source, setSource] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let revoke = () => {}
    void blob
      .text()
      .then((text) => {
        if (cancelled) return
        const hydrated = hydrateDataImagesForPreview(stripMemoExportRefs(text))
        revoke = hydrated.revoke
        setSource(hydrated.markdown)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      revoke()
    }
  }, [blob])

  if (failed) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center px-8 text-center text-sm'>
        {t('preview.loadFailed')}
      </div>
    )
  }

  if (source === null) return null

  return (
    <div title={title} className='h-full overflow-y-auto px-4 py-3'>
      <MemoMarkdownView markdown={(source || '').trim() || htmlFallbackToMd(source || '')} />
    </div>
  )
}
