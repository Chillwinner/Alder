/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { getFileContent } from '@/api/file'
import { cn } from '@/lib/utils'

type Props = {
  fileId: string
  alt?: string
  className?: string
}

/** 列表预览等场景：带鉴权拉取文件并展示图片 */
export function MemoAuthenticatedImage({ fileId, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    void getFileContent(fileId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId])

  if (!src) {
    return (
      <div
        className={cn('rounded-lg bg-surface-secondary/60', className)}
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={cn('max-w-full rounded-lg object-cover', className)}
      loading='lazy'
    />
  )
}
