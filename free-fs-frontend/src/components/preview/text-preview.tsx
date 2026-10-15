/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { previewPaneClass } from '@/components/preview/preview-glass'
import { cn } from '@/lib/utils'

type TextPreviewProps = {
  blob: Blob
}

export function TextPreview({ blob }: TextPreviewProps) {
  const { t } = useTranslation('common')
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void blob.text().then((value) => {
      if (!cancelled) setText(value)
    })
    return () => {
      cancelled = true
    }
  }, [blob])

  if (text === null) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('loading')}
      </div>
    )
  }

  return (
    <pre className={cn(previewPaneClass, 'h-full overflow-auto rounded-md p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-foreground')}>
      {text || t('preview.emptyFile')}
    </pre>
  )
}
