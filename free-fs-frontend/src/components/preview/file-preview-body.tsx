/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import { getPreviewKind } from '@/utils/preview'
import { ArchivePreview } from './archive-preview'
import { AudioPreview } from './audio-preview'
import { DocxPreview } from './docx-preview'
import { ExcelPreview } from './excel-preview'
import { HtmlPreview } from './html-preview'
import { CanvasPreview } from './canvas-preview'
import { MarkdownPreview } from './markdown-preview'
import { ImagePreview } from './image-preview'
import { PdfPreview } from './pdf-preview'
import { TextPreview } from './text-preview'
import { VideoPreview } from './video-preview'

const PptxPreview = lazy(async () => {
  const mod = await import('./pptx-preview')
  return { default: mod.PptxPreview }
})

type FilePreviewBodyProps = {
  file: FileItem
  blob?: Blob | null
  blobUrl?: string | null
  src?: string | null
  onMediaError?: () => void
}

/**
 * 预览正文的错峰入场（keyframes 由 file-preview-dialog 的 <style> 提供）。
 * 只加一层包裹 div，不改变任何一类的内部结构。
 */
export function FilePreviewBody(props: FilePreviewBodyProps) {
  return (
    <div
      className='afile-pv-rise h-full min-h-0 [&>*]:h-full'
      style={{ animationDelay: '190ms' }}
    >
      <PreviewBody {...props} />
    </div>
  )
}

function PreviewBody({ file, blob, blobUrl, src, onMediaError }: FilePreviewBodyProps) {
  const { t } = useTranslation('common')
  const kind = getPreviewKind(file)
  const mediaSrc = src || blobUrl || ''
  const handleMediaError = src ? onMediaError : undefined

  switch (kind) {
    case 'image':
      return (
        <ImagePreview src={mediaSrc} alt={file.displayName} onError={handleMediaError} />
      )
    case 'pdf':
      return (
        <PdfPreview src={mediaSrc} title={file.displayName} onError={handleMediaError} />
      )
    case 'docx':
      return blob ? <DocxPreview blob={blob} /> : null
    case 'pptx':
      return blob ? (
        <Suspense
          fallback={
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              {t('loading')}
            </div>
          }
        >
          <div className='h-full min-h-0'>
            <PptxPreview blob={blob} />
          </div>
        </Suspense>
      ) : null
    case 'excel':
    case 'csv':
      return blob ? <ExcelPreview blob={blob} fileName={file.displayName} kind={kind} /> : null
    case 'video':
      return (
        <VideoPreview
          src={mediaSrc}
          title={file.displayName}
          onError={handleMediaError}
        />
      )
    case 'audio':
      return (
        <AudioPreview
          src={mediaSrc}
          title={file.displayName}
          onError={handleMediaError}
        />
      )
    case 'text':
      return blob ? <TextPreview blob={blob} /> : null
    case 'html':
      return blob ? <HtmlPreview blob={blob} title={file.displayName} /> : null
    case 'markdown':
      return blob ? <MarkdownPreview blob={blob} title={file.displayName} /> : null
    case 'canvas':
      return blob ? <CanvasPreview blob={blob} /> : null
    case 'archive':
      return blob ? <ArchivePreview blob={blob} fileName={file.displayName} /> : null
    default:
      return (
        <div className='text-muted-foreground flex h-full items-center justify-center px-8 text-center text-sm'>
          {t('preview.unsupportedType')}
        </div>
      )
  }
}
