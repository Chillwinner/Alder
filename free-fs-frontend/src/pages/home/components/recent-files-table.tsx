/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import {
  Copy,
  Download,
  Edit,
  Eye,
  Heart,
  Inbox,
  Info,
  MoreHorizontal,
  Move,
  Share2,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesUnit,
} from '@/api/home'
import { getFileAccessUrl, getFileContent } from '@/api/file'
import type { FileItem } from '@/types/file'
import { formatFileListDisplayTime, formatFileSize } from '@/utils/format'
import { fileTileOrigin, openFilePreview, originFromTarget } from '@/utils/preview'
import { useAuth } from '@/contexts/auth-context'
import { setWorkspaceFileDragData } from '@/components/messages/im-drop-files'
import { beginDrag, endDrag } from '@/lib/drag-layer'
import {
  reportImSaveFailed,
  useImMessageWorkspaceDrop,
  useSaveImToWorkspace,
} from '@/hooks/use-save-im-to-workspace'
import { FileTypeIcon } from '@/components/file-type-icon'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'
import { CreateCollectionModal } from '@/pages/files/components/CreateCollectionModal'
import { DeleteConfirmDialog } from '@/pages/files/components/DeleteConfirmDialog'
import { FileDetailModal } from '@/pages/files/components/FileDetailModal'
import FolderDownloadPanel from '@/pages/files/components/FolderDownloadPanel'
import { MoveModal } from '@/pages/files/components/MoveModal'
import { RenameModal } from '@/pages/files/components/RenameModal'
import { ShareModal } from '@/pages/files/components/ShareModal'
import { useFileOperations } from '@/pages/files/hooks/useFileOperations'

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadFile(file: FileItem) {
  const url = await getFileAccessUrl(file.id, 3600, true)
  try {
    const probe = await fetch(url, { method: 'HEAD' })
    if (probe.ok) {
      triggerBrowserDownload(url, file.displayName)
      return
    }
  } catch {
    // fall through
  }
  const blob = await getFileContent(file.id)
  const objectUrl = URL.createObjectURL(blob)
  triggerBrowserDownload(objectUrl, file.displayName)
  URL.revokeObjectURL(objectUrl)
}

function RecentFileMenuItems({
  Item,
  Separator,
  file,
  files,
  canRead,
  canWrite,
  canShare,
  onChanged,
  operations,
  onCollect,
}: {
  Item: typeof DropdownMenuItem
  Separator: typeof DropdownMenuSeparator
  file: FileItem
  files: FileItem[]
  canRead: boolean
  canWrite: boolean
  canShare: boolean
  onChanged: () => void
  operations: ReturnType<typeof useFileOperations>
  onCollect: (file: FileItem) => void
}) {
  const { t: tf } = useTranslation('files')

  return (
    <>
      {!file.isDir && canRead ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.openPreview(file, files)
          }}
        >
          <Eye className='mr-2 h-4 w-4' />
          {tf('rowMenu.preview')}
        </Item>
      ) : null}
      {canShare ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.openShareModal(file)
          }}
        >
          <Share2 className='mr-2 h-4 w-4' />
          {tf('rowMenu.share')}
        </Item>
      ) : null}
      {canShare && canWrite && file.isDir ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            onCollect(file)
          }}
        >
          <Inbox className='mr-2 h-4 w-4' />
          {tf('rowMenu.collect')}
        </Item>
      ) : null}
      {canWrite ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            void operations.handleFavorite(file).finally(onChanged)
          }}
        >
          <Heart
            className={cn(
              'mr-2 h-4 w-4',
              file.isFavorite && 'fill-current text-destructive'
            )}
          />
          {file.isFavorite ? tf('rowMenu.unfavorite') : tf('rowMenu.favorite')}
        </Item>
      ) : null}
      {canRead ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.handleDownload(file)
          }}
        >
          <Download className='mr-2 h-4 w-4' />
          {tf('rowMenu.download')}
        </Item>
      ) : null}
      {canWrite ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.copyToClipboard(file)
          }}
        >
          <Copy className='mr-2 h-4 w-4' />
          {tf('rowMenu.copy')}
        </Item>
      ) : null}
      {canWrite ? <Separator /> : null}
      {canWrite ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.openRenameModal(file)
          }}
        >
          <Edit className='mr-2 h-4 w-4' />
          {tf('rowMenu.rename')}
        </Item>
      ) : null}
      {canWrite ? (
        <Item
          onClick={(event) => {
            event.stopPropagation()
            operations.openMoveModal(file)
          }}
        >
          <Move className='mr-2 h-4 w-4' />
          {tf('rowMenu.move')}
        </Item>
      ) : null}
      <Item
        onClick={(event) => {
          event.stopPropagation()
          operations.openDetail(file)
        }}
      >
        <Info className='mr-2 h-4 w-4' />
        {tf('rowMenu.detail')}
      </Item>
      {canWrite ? (
        <>
          <Separator />
          <Item
            className='text-destructive focus:text-destructive'
            onClick={(event) => {
              event.stopPropagation()
              operations.openDeleteConfirm(file)
            }}
          >
            <Trash2 className='mr-2 h-4 w-4' />
            {tf('rowMenu.trash')}
          </Item>
        </>
      ) : null}
    </>
  )
}

function RecentFilesList({
  files,
  onChanged,
}: {
  files: FileItem[]
  onChanged: () => void
}) {
  const { t } = useTranslation('home')
  const { t: tf } = useTranslation('files')
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const { hasPermission } = usePermission()
  const canRead = hasPermission('file:read')
  const canWrite = hasPermission('file:write')
  const canShare = hasPermission('file:share')
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null)
  const [collectingFolder, setCollectingFolder] = React.useState<FileItem | null>(null)
  const operations = useFileOperations(onChanged)
  const { save: saveImToWorkspace } = useSaveImToWorkspace()
  const { isOver: isImDropOver, dropProps: imDropProps } = useImMessageWorkspaceDrop(
    true,
    (item) => {
      void saveImToWorkspace(item).catch((cause) =>
        reportImSaveFailed(cause, tf('index.saveFromChatFailed'))
      )
    },
    undefined,
    true,
    'home-recent-files'
  )

  const visibleFiles = files.slice(0, 6)

  const openItem = React.useCallback(
    async (file: FileItem, origin?: DOMRect) => {
      if (file.isDir) {
        navigate(`/w/${slug}/files?parentId=${file.id}`)
        return
      }
      openFilePreview(file, {
        navigationFiles: visibleFiles,
        origin: origin ?? fileTileOrigin(file.id) ?? null,
      })
    },
    [visibleFiles, navigate, slug]
  )

  return (
    <section
      data-tilt=''
      className={`glass-card hud-corners h-full p-5 ${
        isImDropOver ? 'ring-2 ring-primary/40' : ''
      }`}
      {...imDropProps}
    >
      <div className='mb-3 flex items-center justify-between gap-3'>
        <h2 className='text-[15px] font-semibold tracking-tight'>
          {t('recentFiles.title')}
        </h2>
        <Link
          to={`/w/${slug}/files`}
          className='text-[13px] font-medium text-text-secondary transition-colors hover:text-foreground'
        >
          {t('recentFiles.manageLink')}
        </Link>
      </div>

      {visibleFiles.length === 0 ? (
        <p className='py-10 text-center text-[13px] text-text-muted'>
          {t('recentFiles.empty')}
        </p>
      ) : (
        <ul>
          {visibleFiles.map((file) => {
            const typeLabel = file.isDir
              ? t('recentFiles.folder')
              : (file.suffix || '').toUpperCase()
            const owner =
              user?.id && file.userId === user.id
                ? t('recentFiles.you')
                : t('recentFiles.member')
            return (
              <li key={file.id}>
                <ContextMenu>
                <ContextMenuTrigger asChild>
                <div
                  role='button'
                  tabIndex={0}
                  draggable
                  data-file-id={file.id}
                  className='group flex h-[52px] items-center gap-3 rounded-[8px] px-2 transition-colors duration-150 hover:bg-surface-hover'
                  onDragStart={(event) => {
                    setWorkspaceFileDragData(event.dataTransfer, [file], { effectAllowed: 'copy' })
                    beginDrag(event, 'file')
                  }}
                  onDragEnd={() => endDrag()}
                  onClick={(event) => void openItem(file, originFromTarget(event.currentTarget))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void openItem(file, originFromTarget(event.currentTarget))
                    }
                  }}
                >
                  <FileTypeIcon
                    type={file.isDir ? 'folder' : file.suffix || 'default'}
                  />
                  <span className='min-w-0 flex-1'>
                    <span
                      className='block truncate text-[14px] font-medium text-text-primary'
                      title={file.displayName}
                    >
                      {file.displayName}
                    </span>
                    <span className='mt-0.5 block truncate text-[12px] text-text-muted'>
                      {typeLabel} · {owner}
                    </span>
                  </span>
                  <span className='hidden w-36 shrink-0 font-mono text-[12px] tabular-nums text-text-muted md:block'>
                    {formatFileListDisplayTime(file.updateTime)}
                  </span>
                  <span className='w-[74px] shrink-0 text-right font-mono text-[12px] whitespace-nowrap tabular-nums text-text-muted'>
                    {file.isDir ? '—' : formatFileSize(file.size)}
                  </span>
                  <span
                    className={cn(
                      'flex w-[72px] shrink-0 justify-end gap-0.5 transition-opacity',
                      openMenuId === file.id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {!file.isDir ? (
                      <button
                        type='button'
                        className='flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-workspace-bg hover:text-foreground'
                        aria-label={t('recentFiles.download')}
                        onClick={(event) => {
                          event.stopPropagation()
                          void downloadFile(file).catch(() =>
                            toast.error(tf('operations.downloadFail'))
                          )
                        }}
                      >
                        <Download className='size-3.5' strokeWidth={1.75} />
                      </button>
                    ) : null}
                    <DropdownMenu
                      modal={false}
                      onOpenChange={(open) => setOpenMenuId(open ? file.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type='button'
                          className='flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-workspace-bg hover:text-foreground'
                          aria-label={t('recentFiles.more')}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className='size-3.5' strokeWidth={1.75} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align='end'
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RecentFileMenuItems
                          Item={DropdownMenuItem}
                          Separator={DropdownMenuSeparator}
                          file={file}
                          files={visibleFiles}
                          canRead={canRead}
                          canWrite={canWrite}
                          canShare={canShare}
                          onChanged={onChanged}
                          operations={operations}
                          onCollect={setCollectingFolder}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <RecentFileMenuItems
                    Item={ContextMenuItem}
                    Separator={ContextMenuSeparator}
                    file={file}
                    files={visibleFiles}
                    canRead={canRead}
                    canWrite={canWrite}
                    canShare={canShare}
                    onChanged={onChanged}
                    operations={operations}
                    onCollect={setCollectingFolder}
                  />
                </ContextMenuContent>
                </ContextMenu>
              </li>
            )
          })}
        </ul>
      )}

      <FolderDownloadPanel
        tasks={operations.folderDownloadTasks}
        onDismiss={operations.dismissFolderDownloadTask}
        onCancel={operations.cancelFolderDownloadTask}
      />
      <RenameModal
        open={operations.renameModalVisible}
        onOpenChange={operations.setRenameModalVisible}
        file={operations.renamingFile}
        onConfirm={operations.handleRename}
      />
      <MoveModal
        open={operations.moveModalVisible}
        onOpenChange={operations.setMoveModalVisible}
        file={operations.movingFile}
        files={operations.movingFiles}
        onConfirm={operations.handleMove}
        onRefresh={onChanged}
      />
      <ShareModal
        open={operations.shareModalVisible}
        onOpenChange={operations.setShareModalVisible}
        file={operations.sharingFile}
        files={operations.sharingFiles}
      />
      <CreateCollectionModal
        open={collectingFolder != null}
        onOpenChange={(open) => {
          if (!open) setCollectingFolder(null)
        }}
        folder={collectingFolder}
      />
      <DeleteConfirmDialog
        open={operations.deleteDialogVisible}
        onOpenChange={operations.setDeleteDialogVisible}
        files={operations.deletingFiles}
        onConfirm={operations.handleDelete}
      />
      <FileDetailModal
        open={operations.detailModalVisible}
        onOpenChange={operations.setDetailModalVisible}
        file={operations.detailFile}
        breadcrumbPath={[]}
      />
    </section>
  )
}

function ListSkeleton() {
  return (
    <div data-tilt='' className='glass-card h-full p-5'>
      <Skeleton className='h-5 w-24' />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className='mt-3 h-[52px] w-full rounded-[8px]' />
      ))}
    </div>
  )
}

export function RecentFilesTable({ unit }: { unit: HomeUsedBytesUnit }) {
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, unit],
    queryFn: () => getHomeInfo({ unit }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const files = data?.recentFiles ?? []

  if (isLoading) return <ListSkeleton />
  if (isError) {
    return (
      <div data-tilt='' className='glass-card h-full px-5 py-10 text-center text-[13px] text-text-muted'>
        {t('recentFiles.loadFailed')}
        <Button
          variant='outline'
          size='sm'
          className='mt-3'
          onClick={() => void refetch()}
        >
          {t('recentFiles.retry')}
        </Button>
      </div>
    )
  }

  return <RecentFilesList files={files} onChanged={() => void refetch()} />
}
