/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem, BreadcrumbItem } from '@/types/file'
import { getFileDetail } from '@/api/file'
import { formatFileSize, formatTime } from '@/utils/format'
import { cn } from '@/lib/utils'
import {
  Copy,
  Download,
  Edit,
  Eye,
  Heart,
  Info,
  Inbox,
  Move,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileIcon } from '@/components/file-icon'
import { isOfficeAiFile } from '@/lib/office-ai-file'
import { isLocalMountId } from '@/lib/storage-mount'

interface FileInspectorProps {
  file: FileItem
  breadcrumbPath: BreadcrumbItem[]
  onClose: () => void
  canRead: boolean
  canWrite: boolean
  canShare: boolean
  onPreview: (file: FileItem) => void
  onAiEdit?: (file: FileItem) => void
  onShare: (file: FileItem) => void
  onCollect?: (folder: FileItem) => void
  onDownload: (file: FileItem) => void
  onCopy: (file: FileItem) => void
  onMove: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onFavorite: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onDetail: (file: FileItem) => void
}

const INSP_CSS = `
@keyframes fsInspIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes fsInspRise{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:none}}
.fs-insp-rise{animation:fsInspRise var(--motion-panel) var(--ease-ios) backwards}
@media (max-width:767px){@keyframes fsInspIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}}
@media (prefers-reduced-motion: reduce){
  .fs-insp-rise{animation:none}
}
`

/** demo 的检查器底部按钮：胶囊、40px 高、灰底（底色由全局 .a-btn--ghost 提供） */
const PILL_BTN = 'a-btn a-btn--ghost border-0 shadow-none'
const PILL_BTN_STYLE: React.CSSProperties = {
  height: 40,
  borderRadius: 999,
  fontSize: 13.5,
}

export function FileInspector({
  file,
  breadcrumbPath,
  onClose,
  canRead,
  canWrite,
  canShare,
  onPreview,
  onAiEdit,
  onShare,
  onCollect,
  onDownload,
  onCopy,
  onMove,
  onRename,
  onFavorite,
  onDelete,
  onDetail,
}: FileInspectorProps) {
  const { t } = useTranslation('files')
  const [loading, setLoading] = useState(false)
  const [detailData, setDetailData] = useState<FileItem | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetailData(null)
    setLoading(true)
    getFileDetail(file.id)
      .then((data) => {
        if (!cancelled) setDetailData(data)
      })
      .catch(() => {
        // 详情接口失败时回退展示列表内的字段，与 FileDetailModal 一致
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [file.id])

  const displayFile = detailData || file

  const formatSizeDisplay = () => {
    if (isLocalMountId(displayFile.id)) return null
    if (displayFile.isDir) {
      return t('fileDetail.sizeWithCounts', {
        size: formatFileSize(displayFile.size || 0),
        files: displayFile.includeFiles ?? 0,
        folders: displayFile.includeFolders ?? 0,
      })
    }
    return formatFileSize(displayFile.size || 0)
  }

  const formatFileLocation = () => {
    if (breadcrumbPath.length === 0) {
      return t('fileDetail.locationRoot')
    }
    return t('fileDetail.locationPath', {
      path: breadcrumbPath.map((item) => item.name).join(' / '),
    })
  }

  const typeLabel = displayFile.isDir
    ? t('table.folderType')
    : displayFile.suffix?.toUpperCase() || t('table.unknownType')

  const sizeDisplay = formatSizeDisplay()
  const metaRows = [
    { label: t('fileDetail.labelName'), value: displayFile.displayName },
    ...(sizeDisplay
      ? [{ label: t('fileDetail.labelSize'), value: sizeDisplay }]
      : []),
    { label: t('table.colType'), value: typeLabel },
    { label: t('fileDetail.labelLocation'), value: formatFileLocation() },
    { label: t('fileDetail.labelUploadTime'), value: formatTime(displayFile.uploadTime) },
    {
      label: t('fileDetail.labelLastAccess'),
      value: displayFile.lastAccessTime ? formatTime(displayFile.lastAccessTime) : '-',
    },
  ]

  return (
    <>
      <style>{INSP_CSS}</style>
      <aside
        key={file.id}
        style={{ animation: 'fsInspIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}
        aria-label={t('fileDetail.detailTitle')}
        className={cn(
          'glass-card pointer-events-auto fixed z-40 flex w-[min(320px,calc(100vw-24px))] flex-col gap-4 overflow-y-auto p-4 shadow-xl',
          'right-3 top-[5.5rem] bottom-24 md:right-6 md:bottom-8'
        )}
      >
        <header className='flex items-center justify-between gap-2'>
          <h2 className='text-[15px] font-semibold tracking-tight text-foreground'>
            {t('fileDetail.detailTitle')}
          </h2>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-7 shrink-0 rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground'
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X strokeWidth={1.9} />
          </Button>
        </header>

        {/* demo 的缩略图头：浅底圆角盒 + 图标 + 粗体名 + mono 类型 chip */}
        <div
          className='fs-insp-rise flex flex-col items-center gap-3 rounded-[14px] border border-border/60 bg-surface-secondary px-4 pt-5 pb-4'
          style={{ animationDelay: '40ms' }}
        >
          <FileIcon
            type={displayFile.isDir ? 'dir' : displayFile.suffix || ''}
            size={64}
          />
          <h3 className='w-full text-center text-[15px] leading-snug font-bold tracking-[-0.02em] break-all text-foreground'>
            {displayFile.displayName}
          </h3>
          <span className='a-tag font-mono text-[11px] tracking-[0.08em] uppercase'>
            {typeLabel}
          </span>
        </div>

        <dl
          className='fs-insp-rise grid gap-0'
          style={{ animationDelay: '90ms' }}
        >
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className='flex items-center justify-between gap-3 py-2.5'>
                  <Skeleton className='h-3 w-14' />
                  <Skeleton className='h-3 w-28' />
                </div>
              ))}
            </>
          ) : (
            metaRows.map((row) => (
              <div
                key={row.label}
                className='flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0'
              >
                <dt className='shrink-0 text-[12.5px] text-text-muted'>
                  {row.label}
                </dt>
                <dd className='min-w-0 font-mono text-[12px] tabular-nums break-all text-right text-text-secondary'>
                  {row.value}
                </dd>
              </div>
            ))
          )}
        </dl>

        <div
          className='fs-insp-rise mt-auto grid grid-cols-2 gap-2'
          style={{ animationDelay: '140ms' }}
        >
          {!file.isDir && canRead && (
            <Button
              type='button'
              size='sm'
              className='a-btn a-btn--secondary col-span-2 border-0 shadow-none'
              style={PILL_BTN_STYLE}
              onClick={() => onPreview(file)}
            >
              <Eye className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.preview')}
            </Button>
          )}
          {canShare && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onShare(file)}
            >
              <Share2 className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.share')}
            </Button>
          )}
          {canRead && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onDownload(file)}
            >
              <Download className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.download')}
            </Button>
          )}
          {canWrite && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onCopy(file)}
            >
              <Copy className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.copy')}
            </Button>
          )}
          {canWrite && !file.systemProtected && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onMove(file)}
            >
              <Move className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.move')}
            </Button>
          )}
          {canWrite && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onRename(file)}
            >
              <Edit className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.rename')}
            </Button>
          )}
          {canWrite && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onFavorite(file)}
            >
              <Heart
                className={cn(
                  'size-3.5',
                  file.isFavorite && 'fill-current text-destructive'
                )}
                strokeWidth={1.9}
              />
              {file.isFavorite ? t('rowMenu.unfavorite') : t('rowMenu.favorite')}
            </Button>
          )}
          {canShare && canWrite && file.isDir && onCollect && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onCollect(file)}
            >
              <Inbox className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.collect')}
            </Button>
          )}
          {canWrite && onAiEdit && isOfficeAiFile(file) && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={PILL_BTN}
              style={PILL_BTN_STYLE}
              onClick={() => onAiEdit(file)}
            >
              <Sparkles className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.aiEdit')}
            </Button>
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className={cn(PILL_BTN, 'col-span-2')}
            style={PILL_BTN_STYLE}
            onClick={() => onDetail(file)}
          >
            <Info className='size-3.5' strokeWidth={1.9} />
            {t('rowMenu.detail')}
          </Button>
          {canWrite && !file.systemProtected && (
            <Button
              type='button'
              variant='destructive'
              size='sm'
              className='col-span-2 border-0 shadow-none'
              style={PILL_BTN_STYLE}
              onClick={() => onDelete(file)}
            >
              <Trash2 className='size-3.5' strokeWidth={1.9} />
              {t('rowMenu.trash')}
            </Button>
          )}
        </div>
      </aside>
    </>
  )
}
