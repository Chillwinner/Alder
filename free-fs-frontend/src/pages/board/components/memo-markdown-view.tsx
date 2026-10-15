/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, type ReactNode } from 'react'
import { memoMdToJson } from '@/lib/memo-md'
import { MEMO_PROSE_CLASS } from '@/lib/memo-prose'
import { cn } from '@/lib/utils'
import { MemoDocPreview } from '@/pages/board/components/memo-doc-preview'

type Props = {
  markdown: string
  memoId?: string
  className?: string
  empty?: ReactNode
}

export function MemoMarkdownView({ markdown, memoId, className, empty }: Props) {
  const doc = useMemo(() => {
    try {
      return memoMdToJson(markdown)
    } catch {
      return { type: 'doc', content: [{ type: 'paragraph' }] }
    }
  }, [markdown])
  if (!markdown.trim()) return empty ?? null
  return (
    <div className={cn(MEMO_PROSE_CLASS, className)}>
      <MemoDocPreview doc={doc} memoId={memoId} />
    </div>
  )
}
