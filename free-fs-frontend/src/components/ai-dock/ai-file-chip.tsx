/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getFileDetail } from '@/api/file'
import { FileIcon } from '@/components/file-icon'
import { AiMemoChip } from '@/components/ai-dock/ai-memo-chip'
import type { AiFileRef } from '@/lib/ai-file-refs'
import { looksLikeMemoFileRef } from '@/lib/ai-file-refs'
import { downloadFileItem } from '@/lib/download-file-item'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { getCurrentSlug } from '@/store/workspace'
import type { FileItem } from '@/types/file'
import { formatFileSize } from '@/utils/format'
import { canPreviewInApp, openFilePreview } from '@/utils/preview'

function toItem(ref: AiFileRef, detail?: FileItem | null): FileItem {
  const name = detail?.displayName || ref.displayName || ref.id
  const suffix =
    detail?.suffix || ref.suffix || (name.includes('.') ? name.split('.').pop() : '') || ''
  return {
    id: ref.id,
    objectKey: detail?.objectKey ?? '',
    originalName: detail?.originalName ?? name,
    displayName: name,
    suffix,
    size: detail?.size ?? ref.size ?? 0,
    mimeType: detail?.mimeType ?? '',
    isDir: detail?.isDir ?? (Boolean(ref.isDir) || ref.id.startsWith('mnt:')),
    parentId: detail?.parentId,
    userId: detail?.userId ?? '',
    uploadTime: detail?.uploadTime ?? '',
    updateTime: detail?.updateTime ?? '',
  }
}

export function AiFileChip({
  file,
  onOpenMemo,
}: {
  file: AiFileRef
  onOpenMemo?: (memo: WorkspaceMemo, origin: DOMRect) => void
}) {
  const { t } = useTranslation(['layout', 'files'])
  const navigate = useNavigate()
  const virtual = file.id.startsWith('mnt:')
  const maybeMemo = looksLikeMemoFileRef(file)
  const query = useQuery({
    queryKey: ['ai-file-chip', file.id],
    queryFn: () => getFileDetail(file.id),
    enabled: Boolean(file.id) && !virtual && !maybeMemo,
    retry: false,
  })
  if ((maybeMemo || query.isError) && onOpenMemo) {
    return (
      <AiMemoChip
        memo={{ id: file.id, title: file.displayName }}
        onOpen={onOpenMemo}
      />
    )
  }
  const item = toItem(file, query.data)
  const slug = getCurrentSlug()
  const folderHref = slug ? `/w/${slug}/files?parentId=${encodeURIComponent(item.id)}` : ''

  const openFolder = () => {
    if (!folderHref) return
    navigate(folderHref)
  }

  const openFile = () => {
    if (item.isDir) {
      openFolder()
      return
    }
    if (canPreviewInApp(item)) {
      openFilePreview(item)
      return
    }
    void downloadFileItem(item).catch(() => toast.error(t('files:operations.downloadFail')))
  }

  return (
    <div className='a-glass flex w-[220px] max-w-full min-w-0 items-center gap-2.5 rounded-[13px] px-3 py-2'>
      <button
        type='button'
        className='flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity duration-150 hover:opacity-85'
        onClick={openFile}
      >
        <span className='flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface-secondary'>
          <FileIcon type={item.isDir ? 'folder' : item.suffix || 'default'} size={20} />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-[12.5px] font-medium' title={item.displayName}>
            {item.displayName}
          </span>
          <span className='block font-mono text-[10.5px] tabular-nums text-text-muted'>
            {item.isDir ? t('ai.openFolder') : formatFileSize(item.size)}
          </span>
        </span>
      </button>
      {!item.isDir ? (
        <button
          type='button'
          className='shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-secondary hover:text-foreground'
          aria-label={t('files:rowMenu.download')}
          onClick={() =>
            void downloadFileItem(item).catch(() => toast.error(t('files:operations.downloadFail')))
          }
        >
          <Download className='size-3.5' />
        </button>
      ) : null}
    </div>
  )
}
