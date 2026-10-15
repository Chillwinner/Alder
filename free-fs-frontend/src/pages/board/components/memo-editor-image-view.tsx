/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { parseMemoImageFileId, resolveMemoImageSrc } from '@/lib/memo-insert-image'
import { cn } from '@/lib/utils'

export function MemoEditorImageView({ node, selected, editor }: NodeViewProps) {
  const src = (node.attrs.src as string | undefined) ?? ''
  const alt = (node.attrs.alt as string | undefined) ?? ''
  const attrFileId = node.attrs.fileId as string | null | undefined
  const fileId = attrFileId || parseMemoImageFileId(src)
  const memoId = (editor?.storage as { memoImageMemoId?: string } | undefined)?.memoImageMemoId
  const displaySrc = resolveMemoImageSrc(
    src || (fileId ? `/apis/file/${fileId}/content` : ''),
    memoId
  )

  return (
    <NodeViewWrapper as='div' className='memo-image-node relative z-0 my-2 w-full max-w-full'>
      <div
        className={cn(
          'overflow-hidden rounded-md',
          selected && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
        )}
        contentEditable={false}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={alt}
            draggable={false}
            className='block h-auto max-h-[min(50vh,420px)] w-full max-w-full object-contain'
          />
        ) : (
          <div
            className='rounded-md border border-dashed border-destructive/40 bg-surface-secondary/60 px-3 py-6 text-center text-xs text-muted-foreground'
            role='img'
            aria-label={alt || 'image'}
          >
            {alt || 'image'}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
