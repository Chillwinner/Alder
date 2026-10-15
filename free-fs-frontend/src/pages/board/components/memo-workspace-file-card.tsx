/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { DragEvent, MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { probeWorkspaceFile } from '@/api/file'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileIcon } from '@/components/file-icon'
import { setWorkspaceFileDragData } from '@/components/messages/im-drop-files'
import { downloadFileItem } from '@/lib/download-file-item'
import {
  memoFileAttrsToFileItem,
  type MemoWorkspaceFileAttrs,
} from '@/lib/memo-workspace-file'
import { formatImFileName } from '@/utils/im-message-content'
import { beginDrag, endDrag } from '@/lib/drag-layer'
import { formatFileSize } from '@/utils/format'
import { openFilePreview } from '@/utils/preview'
import { cn } from '@/lib/utils'

function readAttrs(node: NodeViewProps['node']): MemoWorkspaceFileAttrs | null {
  const fileId = String(node.attrs.fileId ?? '').trim()
  const name = String(node.attrs.name ?? '').trim()
  if (!fileId || !name) return null
  return {
    fileId,
    name,
    size: Number(node.attrs.size) || 0,
    suffix: String(node.attrs.suffix ?? ''),
    isDir: Boolean(node.attrs.isDir),
    mime: String(node.attrs.mime ?? ''),
  }
}

export function MemoReferencedFileCard({
  attrs,
  selected = false,
}: {
  attrs: MemoWorkspaceFileAttrs
  selected?: boolean
}) {
  const { t } = useTranslation(['board', 'messages', 'files'])
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const availability = useQuery({
    queryKey: ['workspace-file-available', attrs.fileId],
    enabled: Boolean(attrs.fileId),
    queryFn: () => probeWorkspaceFile(attrs.fileId),
    staleTime: 30_000,
    retry: false,
  })
  const unavailable = availability.isError
  const live = availability.data
  const size = (Number(live?.size) || attrs.size) || 0
  const file = memoFileAttrsToFileItem({
    ...attrs,
    size,
    name: live?.displayName || live?.originalName || attrs.name,
    suffix: live?.suffix || attrs.suffix,
    mime: live?.mimeType || attrs.mime,
  })
  const iconType = unavailable ? 'invalid' : attrs.isDir ? 'folder' : file.suffix || 'default'

  const openItem = () => {
    if (unavailable) return
    if (attrs.isDir) {
      if (slug) navigate(`/w/${slug}/files?parentId=${encodeURIComponent(attrs.fileId)}`)
      return
    }
    openFilePreview(file)
  }

  const onDownload = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (attrs.isDir || unavailable) return
    void downloadFileItem(file).catch(() =>
      toast.error(t('files:operations.downloadFail'))
    )
  }

  return (
    <article
      data-tilt=''
      draggable
      onDragStart={(event: DragEvent<HTMLElement>) => {
        event.stopPropagation()
        setWorkspaceFileDragData(event.dataTransfer, [file], { effectAllowed: 'copy' })
        beginDrag(event, 'file')
      }}
      onDragEnd={() => endDrag()}
      className={cn(
        'relative my-2 w-full max-w-[min(100%,20rem)] overflow-hidden rounded-[13px] border border-border/60 bg-card',
        'transition-all duration-200 hover:border-primary/40 hover:shadow-md',
        selected && 'ring-2 ring-primary/30'
      )}
    >
      {!attrs.isDir && !unavailable ? (
        <button
          type='button'
          aria-label={t('board:editor.workspaceFileDownload')}
          className='absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-card/95 text-text-muted shadow-sm ring-1 ring-border/60 backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-foreground'
          onClick={onDownload}
        >
          <Download className='size-3.5' strokeWidth={1.75} />
        </button>
      ) : null}
      <button
        type='button'
        className='flex w-full items-center gap-2.5 px-2.5 py-2.5 pe-10 text-left text-foreground'
        onClick={openItem}
      >
        <span className='grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-secondary ring-1 ring-border/50'>
          <FileIcon type={iconType} size={20} />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-[13.5px] font-semibold' title={attrs.name}>
            {formatImFileName(attrs.name, 40)}
          </span>
          {unavailable ? null : (
            <span className='mt-0.5 block font-mono text-[11px] tabular-nums text-text-muted'>
              {attrs.isDir ? '—' : formatFileSize(size)}
            </span>
          )}
          <span className='mt-0.5 block text-[10px] leading-snug text-text-muted/80'>
            {unavailable
              ? t('messages:room.fileUnavailable')
              : t('messages:room.sharedFromWorkspace')}
          </span>
        </span>
      </button>
    </article>
  )
}

export function MemoWorkspaceFileCard({ node, selected }: NodeViewProps) {
  const { t } = useTranslation(['board'])
  const attrs = readAttrs(node)
  if (!attrs) {
    return (
      <NodeViewWrapper className='my-2 block'>
        <p className='text-sm text-muted-foreground'>{t('board:editor.workspaceFileBroken')}</p>
      </NodeViewWrapper>
    )
  }
  return (
    <NodeViewWrapper className='my-2 block max-w-[min(100%,20rem)]' contentEditable={false}>
      <MemoReferencedFileCard attrs={attrs} selected={selected} />
    </NodeViewWrapper>
  )
}
