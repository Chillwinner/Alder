/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { MemoCanvasView } from '@/pages/board/components/memo-canvas-view'

export function CanvasPreview({ blob }: { blob: Blob }) {
  const [document, setDocument] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void blob.text().then((text) => {
      if (!cancelled) setDocument(text)
    })
    return () => {
      cancelled = true
    }
  }, [blob])
  if (document == null) return null
  return <MemoCanvasView document={document} readOnly className='h-full min-h-[420px]' />
}
