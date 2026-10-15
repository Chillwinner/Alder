/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { DragEvent, MouseEvent } from 'react'
import { setWorkspaceFileDragData } from '@/components/messages/im-drop-files'
import { beginDrag, endDrag } from '@/lib/drag-layer'
import { Link } from 'react-router-dom'
import { ArrowUpToLine, Download, Pin, PinOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileIcon } from '@/components/file-icon'
import { downloadFileItem } from '@/lib/download-file-item'
import { Button } from '@/components/ui/button'
import type { FileItem } from '@/types/file'
import { formatFileSize } from '@/utils/format'
import { canPreviewInApp, openFilePreview } from '@/utils/preview'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

type Props = {
  file: FileItem
  slug: string
  previewNavigationFiles?: FileItem[]
  onTogglePin?: () => void
  className?: string
}

function formatFileRowTime(raw?: string) {
  if (!raw) return '—'
  return dayjs(raw).format('YYYY/M/D HH:mm')
}

/** fileshare 行：对齐文件库的「图标底座 + 粗体文件名 + mono 元信息」卡片语言。 */
export function FileshareRow({
  file,
  slug,
  previewNavigationFiles,
  onTogglePin,
  className,
}: Props) {
  const { t } = useTranslation(['board', 'files'])
  const time = file.updateTime || file.uploadTime
  const folderId = file.parentId || file.id
  const href = file.isDir
    ? `/w/${slug}/files?parentId=${encodeURIComponent(file.id)}`
    : `/w/${slug}/files?parentId=${encodeURIComponent(folderId)}`
  const iconType = file.isDir ? 'folder' : file.suffix || 'default'
  const previewable = !file.isDir && canPreviewInApp(file)
  const navFiles = previewNavigationFiles ?? [file]

  const metaLine = (
    <p className='mt-1 font-mono text-[11px] leading-tight tabular-nums text-text-muted'>
      <span className='whitespace-nowrap'>
        {file.isDir ? '—' : formatFileSize(file.size)}
      </span>
      <span className='px-1 opacity-50'>·</span>
      <span className='whitespace-nowrap'>{formatFileRowTime(time)}</span>
    </p>
  )

  /* demo 的图标底座：w-10 h-10 rounded-2xl + 淡玻璃底 + 细描边 */
  const iconBlock = (
    <span className='relative grid size-9 shrink-0 place-items-center rounded-[13px] border border-border/50 bg-surface-secondary/70 ring-1 ring-white/5 sm:size-10'>
      {file.boardPinned ? (
        <Pin
          className='absolute -top-1 -left-1 size-3 fill-destructive text-destructive'
          aria-hidden
        />
      ) : null}
      <FileIcon type={iconType} size={22} />
    </span>
  )

  const titleBlock = (
    <div className='min-w-0 flex-1 overflow-hidden'>
      <p
        className='line-clamp-2 text-[13px] leading-snug font-semibold break-all text-foreground hyphens-auto sm:text-[13.5px]'
        title={file.displayName}
      >
        {file.displayName}
      </p>
      {metaLine}
    </div>
  )

  const openPreview = () => {
    openFilePreview(file, { navigationFiles: navFiles })
  }

  const handleDownload = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void downloadFileItem(file).catch(() =>
      toast.error(t('files:operations.downloadFail'))
    )
  }

  const onDragStart = (e: DragEvent<HTMLElement>) => {
    e.stopPropagation()
    setWorkspaceFileDragData(e.dataTransfer, [file], { effectAllowed: 'copy' })
    beginDrag(e, 'file')
  }
  const onDragEnd = () => endDrag()

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'board-fileshare-row board-inner-row group flex w-full max-w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-[14px] border border-border/50 bg-card/60 p-2.5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80 hover:shadow-md sm:gap-3',
        file.boardPinned && 'border-primary/25',
        className
      )}
    >
      {previewable ? (
        <button
          type='button'
          className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-start sm:gap-2.5'
          onClick={openPreview}
        >
          {iconBlock}
          {titleBlock}
        </button>
      ) : (
        <Link
          to={href}
          className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-2.5'
        >
          {iconBlock}
          {titleBlock}
        </Link>
      )}

      <div className='flex shrink-0 items-center gap-0.5'>
        {!file.isDir ? (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='size-8 rounded-full p-0 text-text-muted hover:bg-surface-hover hover:text-foreground'
            aria-label={t('files:rowMenu.download')}
            onClick={handleDownload}
          >
            <Download className='size-4' strokeWidth={2} aria-hidden />
          </Button>
        ) : null}

        {onTogglePin ? (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className={cn(
              'size-8 rounded-full p-0 hover:bg-surface-hover',
              file.boardPinned
                ? 'text-primary hover:text-primary'
                : 'text-text-muted hover:text-foreground'
            )}
            aria-label={
              file.boardPinned ? t('fileCard.unpin') : t('fileCard.pin')
            }
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onTogglePin()
            }}
          >
            {file.boardPinned ? (
              <PinOff className='size-4' strokeWidth={2} aria-hidden />
            ) : (
              <ArrowUpToLine className='size-4' strokeWidth={2} aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
