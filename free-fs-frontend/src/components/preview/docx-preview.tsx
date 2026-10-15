/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderAsync } from 'docx-preview'
import { previewPaneClass } from '@/components/preview/preview-glass'
import { cn } from '@/lib/utils'

type DocxPreviewProps = {
  blob: Blob
}

export function DocxPreview({ blob }: DocxPreviewProps) {
  const { t } = useTranslation('common')
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scroller = container.parentElement
    const keep = scroller ? scroller.scrollTop : 0
    container.innerHTML = ''
    setError(null)
    void renderAsync(blob, container, undefined, {
      inWrapper: true,
      ignoreWidth: true,
      breakPages: true,
      useBase64URL: true,
    }).then(() => {
      if (scroller) scroller.scrollTop = keep
    }).catch(() => {
      setError(t('preview.loadFailed'))
    })
  }, [blob, t])

  if (error) {
    return (
      <div className='text-destructive flex h-full items-center justify-center text-sm'>
        {error}
      </div>
    )
  }

  return (
    <div className={cn(previewPaneClass, 'h-full overflow-auto p-4')}>
      <div ref={containerRef} className='mx-auto max-w-[920px] bg-surface text-foreground' />
    </div>
  )
}
