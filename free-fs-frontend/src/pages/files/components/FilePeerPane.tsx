/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { getFileList, getFolderPath } from '@/api/file'
import {
  collectImMessageDrag,
  collectMemoDrag,
  FREEFS_IM_MESSAGE_MIME,
  FREEFS_MEMOS_MIME,
  type ImMessageDragItem,
} from '@/components/messages/im-drop-files'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { Button } from '@/components/ui/button'
import type { BreadcrumbItem, FileItem } from '@/types/file'
import { FileBreadcrumb } from './FileBreadcrumb'
import { FileGridView } from './FileGridView'
import { FileLibrarySkeleton } from './FileLibrarySkeleton'
import { StorageMountBar } from './StorageMountBar'
import { FILE_LIST_PAGE_SIZE } from '../hooks/useFileList'
import { playLandBounce } from '@/lib/drag-layer'

interface FilePeerPaneProps {
  initialParentId?: string
  onClose: () => void
  onMoveFiles: (fileIds: string[], targetDirId: string) => Promise<void>
  onImportIm: (item: ImMessageDragItem, targetDirId?: string) => Promise<void>
  onImportMemo: (memos: WorkspaceMemo[], targetDirId?: string) => Promise<void>
  onRefreshReady: (refresh: (() => void) | null) => void
  onDownload: (file: FileItem | FileItem[]) => void
  onCopy: (file: FileItem | FileItem[]) => void
  onShare: (file: FileItem) => void
  onDelete: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onMove: (file: FileItem) => void
  onFavorite: (file: FileItem | FileItem[]) => void
  onPreview: (file: FileItem, list: FileItem[]) => void
  onAiEdit?: (file: FileItem) => void
  onDetail: (file: FileItem) => void
}

export function FilePeerPane({
  initialParentId,
  onClose,
  onMoveFiles,
  onImportIm,
  onImportMemo,
  onRefreshReady,
  onDownload,
  onCopy,
  onShare,
  onDelete,
  onRename,
  onMove,
  onFavorite,
  onPreview,
  onAiEdit,
  onDetail,
}: FilePeerPaneProps) {
  const { t } = useTranslation('files')
  const [parentId, setParentId] = useState(initialParentId)
  const [files, setFiles] = useState<FileItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const pageRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setSelectedKeys([])
    try {
      const response = await getFileList({
        parentId,
        orderBy: 'updateTime',
        orderDirection: 'DESC',
        page: 1,
        pageSize: FILE_LIST_PAGE_SIZE,
      })
      const records = response?.records ?? []
      setFiles(records)
      setTotal(response?.total ?? records.length)
      pageRef.current = 1
      if (!parentId) {
        setBreadcrumb([])
      } else {
        const path = await getFolderPath(parentId)
        setBreadcrumb(
          (path ?? []).map((item) => ({
            id: item.id,
            name: item.displayName,
          }))
        )
      }
    } catch {
      setFiles([])
      setTotal(0)
      setBreadcrumb([])
    } finally {
      setLoading(false)
    }
  }, [parentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    onRefreshReady(refresh)
    return () => onRefreshReady(null)
  }, [onRefreshReady, refresh])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || files.length >= total) return
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      const response = await getFileList({
        parentId,
        orderBy: 'updateTime',
        orderDirection: 'DESC',
        page: nextPage,
        pageSize: FILE_LIST_PAGE_SIZE,
      })
      const records = response?.records ?? []
      setFiles((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...records.filter((item) => !seen.has(item.id))]
      })
      pageRef.current = nextPage
    } finally {
      setLoadingMore(false)
    }
  }, [files.length, loading, loadingMore, parentId, total])

  const openFolder = (folderId?: string) => {
    setParentId(folderId)
  }

  const acceptFileDrop = (event: React.DragEvent) => {
    const types = Array.from(event.dataTransfer.types)
    return (
      types.includes('application/json') ||
      types.includes(FREEFS_IM_MESSAGE_MIME) ||
      types.includes(FREEFS_MEMOS_MIME)
    )
  }

  return (
    <section className='glass-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
      <div className='flex items-center gap-2 border-b border-border/60 px-4 pt-3 pb-2'>
        <div className='min-w-0 flex-1'>
          <FileBreadcrumb breadcrumbPath={breadcrumb} onNavigate={openFolder} />
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8 shrink-0 text-muted-foreground transition-colors hover:text-foreground'
          onClick={onClose}
          aria-label={t('toolbar.closeDualWindow')}
          title={t('toolbar.closeDualWindow')}
        >
          <X />
        </Button>
      </div>
      <StorageMountBar
        activeId={breadcrumb[0]?.id}
        currentParentId={parentId}
        onOpen={openFolder}
        onMove={onMoveFiles}
        onImportIm={onImportIm}
        onImportMemo={onImportMemo}
      />
      <div
        ref={scrollRef}
        className='min-h-0 flex-1 overflow-auto px-4 pb-6'
        onDragOver={(event) => {
          if (!acceptFileDrop(event) || !parentId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }}
        onDrop={(event) => {
          if (!parentId) return
          const target = event.target as HTMLElement
          if (target.closest('[data-file-id]')) return
          const memos = collectMemoDrag(event)
          if (memos.length > 0) {
            event.preventDefault()
            void onImportMemo(memos, parentId)
            playLandBounce(event.currentTarget)
            return
          }
          const chatItem = collectImMessageDrag(event)
          if (chatItem) {
            event.preventDefault()
            void onImportIm(chatItem, parentId)
            playLandBounce(event.currentTarget)
            return
          }
          const raw = event.dataTransfer.getData('application/json')
          if (!raw) return
          event.preventDefault()
          try {
            const ids = JSON.parse(raw) as string[]
            if (Array.isArray(ids) && ids.length > 0) {
              void onMoveFiles(ids, parentId)
              playLandBounce(event.currentTarget)
            }
          } catch {
            // 不是文件拖拽
          }
        }}
      >
        {loading ? (
          <FileLibrarySkeleton variant='grid' rows={8} />
        ) : files.length === 0 ? (
          <div className='flex h-full min-h-48 items-center justify-center'>
            <p className='text-[13.5px] text-muted-foreground'>{t('index.emptyTitle')}</p>
          </div>
        ) : (
          <FileGridView
            fileList={files}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onFileClick={(file) => {
              if (file.isDir) openFolder(file.id)
            }}
            onDownload={onDownload}
            onCopy={onCopy}
            onShare={onShare}
            onDelete={onDelete}
            onRename={onRename}
            onMove={onMove}
            onMoveFiles={onMoveFiles}
            onImportIm={onImportIm}
            onImportMemo={onImportMemo}
            onFavorite={onFavorite}
            onPreview={(file) => onPreview(file, files)}
            onAiEdit={onAiEdit}
            onDetail={onDetail}
            hasMore={files.length < total}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            scrollRootRef={scrollRef}
          />
        )}
      </div>
    </section>
  )
}
