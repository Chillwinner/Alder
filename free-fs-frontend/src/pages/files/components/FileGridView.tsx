/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import { nextFileSelection, openFileTarget } from '@/pages/files/file-item-gestures'
import {
  MoreHorizontal,
  Download,
  Share2,
  Heart,
  Move,
  Trash2,
  Edit,
  Eye,
  Info,
  Copy,
  Inbox,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize, formatTime } from '@/utils/format'
import { usePermission } from '@/hooks/use-permission'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger, ContextMenuGroup } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import { FileIcon } from '@/components/file-icon'
import Folder from '@/components/Folder'
import { useFileDragDrop } from '../hooks/useFileDragDrop'
import { FileLibrarySkeleton } from './FileLibrarySkeleton'
import { FileListScrollSentinel } from './FileListScrollSentinel'
import { isOfficeAiFile } from '@/lib/office-ai-file'

interface FileGridViewProps {
  fileList: FileItem[]
  selectedKeys: string[]
  onSelectionChange: (keys: string[]) => void
  onFileClick: (file: FileItem) => void
  onDownload: (file: FileItem | FileItem[]) => void
  onCopy: (file: FileItem | FileItem[]) => void
  onShare: (file: FileItem) => void
  onCollect?: (folder: FileItem) => void
  onDelete: (file: FileItem) => void
  onRename: (file: FileItem) => void
  onMove: (file: FileItem) => void
  onMoveFiles: (fileIds: string[], targetDirId: string) => Promise<void>
  onImportIm?: (
    item: import('@/components/messages/im-drop-files').ImMessageDragItem,
    targetDirId?: string
  ) => Promise<void>
  onImportMemo?: (
    memos: import('@/types/workspace-board').WorkspaceMemo[],
    targetDirId?: string
  ) => Promise<void>
  onFavorite: (file: FileItem | FileItem[]) => void
  onPreview: (file: FileItem) => void
  onAiEdit?: (file: FileItem) => void
  onDetail: (file: FileItem) => void
  onDragStateChange?: (
    dropTargetName: string | null,
    draggedCount: number
  ) => void
  onBatchShare?: (files: FileItem[]) => void
  onBatchCopy?: (files: FileItem[]) => void
  onBatchMove?: (files: FileItem[]) => void
  onBatchDelete?: (files: FileItem[]) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /** 主内容区滚动容器，用于触底自动加载 */
  scrollRootRef?: RefObject<HTMLElement | null>
}

export function FileGridView({
  fileList,
  selectedKeys,
  onSelectionChange,
  onFileClick,
  onDownload,
  onCopy,
  onShare,
  onCollect,
  onDelete,
  onRename,
  onMove,
  onMoveFiles,
  onImportIm,
  onImportMemo,
  onFavorite,
  onPreview,
  onAiEdit,
  onDetail,
  onDragStateChange,
  onBatchShare,
  onBatchCopy,
  onBatchMove,
  onBatchDelete,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  scrollRootRef,
}: FileGridViewProps) {
  const { t } = useTranslation('files')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const { hasPermission } = usePermission()
  const canRead = hasPermission('file:read')
  const canWrite = hasPermission('file:write')
  const canShare = hasPermission('file:share')

  // 提到 map 外部，避免每个 item 重复计算
  const selectedSet = new Set(selectedKeys)
  const selectedFiles = fileList.filter((f) => selectedSet.has(f.id))
  const hasUnfavorited = selectedFiles.some((f) => !f.isFavorite)

  // 拖拽功能
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileDragDrop(
    selectedKeys,
    fileList,
    onMoveFiles,
    onImportIm,
    (folderId) => {
      const folder = fileList.find((item) => item.id === folderId)
      if (folder?.isDir) onFileClick(folder)
    },
    onImportMemo
  )

  // 通知父组件拖拽状态变化
  useEffect(() => {
    if (onDragStateChange) {
      onDragStateChange(dragState.dropTargetName, dragState.draggedItems.length)
    }
    // onDragStateChange 是父组件传入的稳定引用，不加入依赖以避免无效重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState.dropTargetName, dragState.draggedItems.length])

  const handleItemClick = (file: FileItem, event: React.MouseEvent) => {
    onSelectionChange(nextFileSelection(selectedKeys, file.id, event.ctrlKey || event.metaKey))
  }

  const handleDoubleClick = (file: FileItem) => {
    openFileTarget(file, canRead, () => onFileClick(file), () => onPreview(file))
  }

  const handleThumbnailDoubleClick = (
    file: FileItem,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation()
    openFileTarget(file, canRead, () => onFileClick(file), () => onPreview(file))
  }

  /** 已全部拉取且无加载中时展示（与常见网盘底部提示一致） */
  const showNoMoreHint =
    !hasMore && !loadingMore && fileList.length > 0

  return (
    <div className='p-1'>
      <div className='relative'>
        <div className='a-fgrid'>
        {fileList.map((file) => {
          const isSelected = selectedSet.has(file.id)
          const isDragging = dragState.draggedItems.some(
            (f) => f.id === file.id
          )
          const isDropTarget = file.isDir && dragState.dropTargetId === file.id
          const isMultiSelected = selectedKeys.length > 1 && isSelected
          const folderEntries = file.isDir
            ? (file.includeFiles ?? 0) + (file.includeFolders ?? 0)
            : 0

          return (
            <ContextMenu key={file.id}>
              <ContextMenuTrigger asChild>
                <div
                  data-tilt=''
                  data-file-id={file.id}
                  className={cn(
                    /*
                      demo 的两层卡片：外层 .a-fcard 托底，内层 .a-fcard__inner 是玻璃面
                      .a-hoverable 是 .a-glyph 悬停动画的宿主开关

                      ⚠️ 这里**刻意去掉**了 'tech-rise'（原值 'a-fcard a-hoverable tech-rise group'）。
                      原因：卡片自带 data-tilt，而 PageMotion 的 CASCADE_SELECTOR
                      ('header, section, .glass-card, [data-tilt]') 已经覆盖它，
                      moCascade 会做同样的「上浮 + 淡入」入场。

                      两个入场动画叠在同一个元素上会互相抢 transform：
                      tech-rise 是**样式表动画**，而 [data-tilt]:hover 的
                      `animation: none` 只在悬停期间压制它 —— 鼠标一移出、
                      :hover 失效，tech-rise 立刻**复活重播**
                      → 卡片从 translateY(10px)/opacity:0 重新淡入 =「闪一下」。
                      （实测移出后 90/90 帧 animationName='tech-rise'）
                    */
                    'a-fcard a-hoverable group',
                    isSelected && 'selected',
                    /*
                      拖拽源反馈：用统一的 .drag-source-active
                      （变暗 0.55 + 缩小 0.97 + 倾斜 -1.2°，见 styles/drag-layer.css）。
                      原来是 `cursor-move opacity-50` —— 只有变淡，没有"被拿起来"的手感。
                      cursor 交给 body[data-dragging] 统一管（grabbing）。
                    */
                    isDragging && 'drag-source-active cursor-move',
                    isDropTarget && 'is-folder-drop-target'
                  )}
                  draggable={!openMenuId}
                  onDragStart={(e) => handleDragStart(e, file)}
                  onDragEnd={() => canWrite && handleDragEnd()}
                  onDragEnter={(e) => canWrite && handleDragEnter(e, file)}
                  onDragOver={(e) => canWrite && handleDragOver(e, file)}
                  onDragLeave={(e) => canWrite && handleDragLeave(e, file)}
                  onDrop={(e) => canWrite && handleDrop(e, file)}
                  onClick={(e) => handleItemClick(file, e)}
                  onDoubleClick={() => handleDoubleClick(file)}
                >
                  {/* demo 的两层玻璃：内层才是真正的内容面板 */}
                  <div className='a-fcard__inner'>
                  {/* 更多操作 */}
                  <div
                    className={cn(
                      'absolute top-2 right-2 z-10 transition-opacity',
                      openMenuId === file.id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    )}
                    style={{ visibility: isSelected ? 'hidden' : 'visible' }}
                  >
                    <DropdownMenu
                      modal={false}
                      onOpenChange={(open) =>
                        setOpenMenuId(open ? file.id : null)
                      }
                    >
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-[26px] w-[26px] rounded-[9px] text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
<DropdownMenuGroup>
                        {!file.isDir && canRead && (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onPreview(file)
                              }}
                            >
                              <Eye className='mr-2 h-4 w-4' />
                              {t('rowMenu.preview')}
                            </DropdownMenuItem>
                          </>
                        )}
                        {canWrite && onAiEdit && isOfficeAiFile(file) && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onAiEdit(file)
                            }}
                          >
                            <Sparkles className='mr-2 h-4 w-4' />
                            {t('rowMenu.aiEdit')}
                          </DropdownMenuItem>
                        )}
                        {canShare && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onShare(file)
                            }}
                          >
                            <Share2 className='mr-2 h-4 w-4' />
                            {t('rowMenu.share')}
                          </DropdownMenuItem>
                        )}
                        {canShare && canWrite && file.isDir && onCollect && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onCollect(file)
                            }}
                          >
                            <Inbox className='mr-2 h-4 w-4' />
                            {t('rowMenu.collect')}
                          </DropdownMenuItem>
                        )}
                        {canWrite && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onFavorite(file)
                            }}
                          >
                            <Heart
                              className={cn(
                                'mr-2 h-4 w-4',
                                file.isFavorite && 'fill-current text-destructive'
                              )}
                            />
                            {file.isFavorite
                              ? t('rowMenu.unfavorite')
                              : t('rowMenu.favorite')}
                          </DropdownMenuItem>
                        )}
                        {canRead && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onDownload(file)
                            }}
                          >
                            <Download className='mr-2 h-4 w-4' />
                            {t('rowMenu.download')}
                          </DropdownMenuItem>
                        )}
                        {canWrite && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onCopy(file)
                            }}
                          >
                            <Copy className='mr-2 h-4 w-4' />
                            {t('rowMenu.copy')}
                          </DropdownMenuItem>
                        )}
                        {canWrite && <DropdownMenuSeparator />}
                        {canWrite && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onRename(file)
                            }}
                          >
                            <Edit className='mr-2 h-4 w-4' />
                            {t('rowMenu.rename')}
                          </DropdownMenuItem>
                        )}
                        {canWrite && !file.systemProtected && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onMove(file)
                            }}
                          >
                            <Move className='mr-2 h-4 w-4' />
                            {t('rowMenu.move')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onDetail(file)
                          }}
                        >
                          <Info className='mr-2 h-4 w-4' />
                          {t('rowMenu.detail')}
                        </DropdownMenuItem>
                        {canWrite && !file.systemProtected && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onDelete(file)
                              }}
                              className='text-destructive'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              {t('rowMenu.trash')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuGroup>
</DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 缩略图：demo 把图标放在卡片顶部左对齐，和「更多」同一行 */}
                  <div className='a-fcard__top'>
                    <div
                      onDoubleClick={(event) =>
                        handleThumbnailDoubleClick(file, event)
                      }
                    >
                      {file.isDir ? (
                        <Folder size={0.48} className='pointer-events-none' />
                      ) : (
                        <FileIcon
                          type={file.suffix || ''}
                          size={46}
                        />
                      )}
                    </div>
                  </div>

                  {/* 文件名：demo 是卡片里唯一的粗体行 */}
                  <div
                    className='a-fcard__name text-[14.5px] font-bold tracking-[-0.02em] text-foreground'
                    title={file.displayName}
                  >
                    {file.displayName}
                  </div>

                  {/* 大小 · 修改时间（demo：贴卡片底部一行，全 mono） */}
                  <div className='a-fcard__meta flex-wrap font-mono text-[11px] tabular-nums'>
                    <span className='shrink-0'>
                      {file.isDir
                        ? folderEntries > 0
                          ? `${folderEntries} 项`
                          : '—'
                        : formatFileSize(file.size)}
                    </span>
                    <span className='a-fcard__dot shrink-0'>·</span>
                    <span className='whitespace-nowrap'>{formatTime(file.updateTime)}</span>
                  </div>

                  {/*
                    demo 的底部行：分隔线 + 左描述右箭头。
                    箭头沿用 demo 的 group-hover 才显形，不改变任何交互。
                  */}
                  <div className='a-fcard__foot'>
                    <span className='min-w-0 truncate text-[11px] text-text-muted'>
                      {file.isDir
                        ? t('table.folderType')
                        : (file.suffix || '—').toUpperCase()}
                    </span>
                    {file.isFavorite && (
                      <span className='a-tag a-tag--accent shrink-0 gap-1 px-2 py-0.5'>
                        <Heart className='size-3 fill-current' strokeWidth={1.9} />
                      </span>
                    )}
                    <span className='a-fcard__arrow' aria-hidden>
                      <ArrowUpRight className='size-3.5' strokeWidth={2} />
                    </span>
                  </div>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
<ContextMenuGroup>
                {isMultiSelected ? (
                  // 多选菜单
                  <>
                    {canRead && selectedFiles.length > 0 && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(selectedFiles)
                        }}
                      >
                        <Download className='mr-2 h-4 w-4' />
                        {t('rowMenu.download')}
                      </ContextMenuItem>
                    )}
                    {canWrite && onBatchCopy && selectedFiles.length > 0 && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onBatchCopy(selectedFiles)
                        }}
                      >
                        <Copy className='mr-2 h-4 w-4' />
                        {t('rowMenu.copy')}
                      </ContextMenuItem>
                    )}
                    {canShare && onBatchShare && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onBatchShare(selectedFiles)
                        }}
                      >
                        <Share2 className='mr-2 h-4 w-4' />
                        {t('rowMenu.share')}
                      </ContextMenuItem>
                    )}
                    {canWrite && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onFavorite(selectedFiles)
                        }}
                      >
                        <Heart
                          className={cn(
                            'mr-2 h-4 w-4',
                            !hasUnfavorited && 'fill-current text-destructive'
                          )}
                        />
                        {hasUnfavorited
                          ? t('rowMenu.favorite')
                          : t('rowMenu.unfavorite')}
                      </ContextMenuItem>
                    )}
                    {canWrite && <ContextMenuSeparator />}
                    {canWrite && onBatchMove && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onBatchMove(selectedFiles)
                        }}
                      >
                        <Move className='mr-2 h-4 w-4' />
                        {t('rowMenu.move')}
                      </ContextMenuItem>
                    )}
                    {canWrite && onBatchDelete && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onBatchDelete(selectedFiles)
                        }}
                        className='text-destructive focus:text-destructive'
                      >
                        <Trash2 className='mr-2 h-4 w-4' />
                        {t('rowMenu.trash')}
                      </ContextMenuItem>
                    )}
                  </>
                ) : (
                  // 单选菜单
                  <>
                    {!file.isDir && canRead && (
                      <>
                        <ContextMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onPreview(file)
                          }}
                        >
                          <Eye className='mr-2 h-4 w-4' />
                          {t('rowMenu.preview')}
                        </ContextMenuItem>
                      </>
                    )}
                    {canWrite && onAiEdit && isOfficeAiFile(file) && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onAiEdit(file)
                        }}
                      >
                        <Sparkles className='mr-2 h-4 w-4' />
                        {t('rowMenu.aiEdit')}
                      </ContextMenuItem>
                    )}
                    {canShare && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onShare(file)
                        }}
                      >
                        <Share2 className='mr-2 h-4 w-4' />
                        {t('rowMenu.share')}
                      </ContextMenuItem>
                    )}
                    {canShare && canWrite && file.isDir && onCollect && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onCollect(file)
                        }}
                      >
                        <Inbox className='mr-2 h-4 w-4' />
                        {t('rowMenu.collect')}
                      </ContextMenuItem>
                    )}
                    {canWrite && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onFavorite(file)
                        }}
                      >
                        <Heart
                          className={cn(
                            'mr-2 h-4 w-4',
                            file.isFavorite && 'fill-current text-destructive'
                          )}
                        />
                        {file.isFavorite
                          ? t('rowMenu.unfavorite')
                          : t('rowMenu.favorite')}
                      </ContextMenuItem>
                    )}
                    {canRead && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(file)
                        }}
                      >
                        <Download className='mr-2 h-4 w-4' />
                        {t('rowMenu.download')}
                      </ContextMenuItem>
                    )}
                    {canWrite && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onCopy(file)
                        }}
                      >
                        <Copy className='mr-2 h-4 w-4' />
                        {t('rowMenu.copy')}
                      </ContextMenuItem>
                    )}
                    {canWrite && <ContextMenuSeparator />}
                    {canWrite && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onRename(file)
                        }}
                      >
                        <Edit className='mr-2 h-4 w-4' />
                        {t('rowMenu.rename')}
                      </ContextMenuItem>
                    )}
                    {canWrite && !file.systemProtected && (
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onMove(file)
                        }}
                      >
                        <Move className='mr-2 h-4 w-4' />
                        {t('rowMenu.move')}
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onDetail(file)
                      }}
                    >
                      <Info className='mr-2 h-4 w-4' />
                      {t('rowMenu.detail')}
                    </ContextMenuItem>
                    {canWrite && !file.systemProtected && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(file)
                          }}
                          className='text-destructive focus:text-destructive'
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          {t('rowMenu.trash')}
                        </ContextMenuItem>
                      </>
                    )}
                  </>
                )}
              </ContextMenuGroup>
</ContextMenuContent>
            </ContextMenu>
          )
        })}
        </div>
      </div>
      {scrollRootRef && onLoadMore && (
        <FileListScrollSentinel
          scrollRootRef={scrollRootRef}
          hasMore={!!hasMore}
          onLoadMore={onLoadMore}
        />
      )}
      {loadingMore && (
        <div className='pt-3'>
          <FileLibrarySkeleton variant='grid' rows={4} />
        </div>
      )}
      {showNoMoreHint && (
        <p className='mt-6 pb-2 text-center text-sm text-muted-foreground/55'>
          {t('index.noMore')}
        </p>
      )}
    </div>
  )
}
