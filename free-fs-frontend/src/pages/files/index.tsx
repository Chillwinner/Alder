/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import {
  List,
  Grid2X2,
  FileText,
  Upload,
  FolderPlus,
  FolderUp,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ClipboardPaste,
  Columns2,
} from 'lucide-react'
import { useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { playLandBounce } from '@/lib/drag-layer'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NoPermission } from '@/components/no-permission'
import { DropOverlay } from '@/components/drop-overlay'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger, ContextMenuGroup } from '@/components/ui/context-menu'
import { usePermission } from '@/hooks/use-permission'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import {
  Toolbar,
  FileBreadcrumb,
  FileGridView,
  FileListView,
  CreateFolderModal,
  RenameModal,
  MoveModal,
  ShareModal,
  FileBulkSelectionBar,
  RecycleBinView,
  DeleteConfirmDialog,
  FileDetailModal,
  MyCollectionsView,
  CreateCollectionModal,
  FolderTree,
  FileInspector,
  FileLibrarySkeleton,
  type FolderTreeViewEntry,
} from './components'
import UploadModal from './components/UploadModal'
import { StorageMountBar } from './components/StorageMountBar'
import { FilePeerPane } from './components/FilePeerPane'
import UploadPanel from './components/UploadPanel'
import FolderDownloadPanel from './components/FolderDownloadPanel'
import { useFileList } from './hooks/useFileList'
import { useFileOperations } from './hooks/useFileOperations'
import './files-bento.css'
import { useOfficeEditStore } from '@/store/office-edit'
import { useTransferStore } from '@/store/transfer'
import {
  reportImSaveFailed,
  useImMessageWorkspaceDrop,
  useSaveImToWorkspace,
} from '@/hooks/use-save-im-to-workspace'
import {
  reportMemoSaveFailed,
  useSaveMemoToFolder,
} from '@/hooks/use-save-memo-to-folder'
import { useDragState } from '@/hooks/use-drag-layer'
import { useShortcutBindings } from '@/hooks/use-shortcut-bindings'

type ViewMode = 'list' | 'grid'

export default function FilesPage() {
  const { t } = useTranslation('files')
  const { t: tLayout } = useTranslation('layout')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { hasPermission } = usePermission()
  const { matches: matchShortcut } = useShortcutBindings()
  const openOfficeEdit = useOfficeEditStore((s) => s.open)

  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('viewMode') as ViewMode) || 'grid'
  )

  // 选中的文件
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  // 上传弹窗状态
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadDirectoryMode, setUploadDirectoryMode] = useState(false)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)
  const [collectingFolder, setCollectingFolder] = useState<FileItem | null>(null)

  // 拖拽状态
  const [dragTargetName, setDragTargetName] = useState<string | null>(null)
  const [draggedCount, setDraggedCount] = useState(0)
  const dragAnchorRef = useRef<{ parentId?: string; files: FileItem[] } | null>(
    null
  )

  const fileScrollAreaRef = useRef<HTMLDivElement>(null)

  const fileList = useFileList()
  const fileListRefreshVersion = useTransferStore(
    (state) => state.fileListRefreshVersion
  )
  const lastHandledRefreshVersionRef = useRef(0)

  /**
   * 清空选中
   */
  const clearSelection = () => {
    setSelectedKeys([])
  }

  const [dualOpen, setDualOpen] = useState(false)
  const [peerParentId, setPeerParentId] = useState<string | undefined>()
  const [peerSession, setPeerSession] = useState(0)
  const peerRefreshRef = useRef<(() => void) | null>(null)
  const refreshBoth = useCallback(() => {
    fileList.refresh()
    peerRefreshRef.current?.()
  }, [fileList.refresh])
  const bindPeerRefresh = useCallback((refresh: (() => void) | null) => {
    peerRefreshRef.current = refresh
  }, [])

  const operations = useFileOperations(refreshBoth, clearSelection, () => {
    // 在特殊视图中创建文件夹后，返回全部文件页面
    if (isFavoritesView || isTypeFilter || isDirFilter) {
      navigate(`/w/${slug}/files?viewMode=${viewMode}`)
    }
  }, fileList.updateFileItems)

  // 计算当前视图类型
  const viewType = searchParams.get('view')
  const fileType = searchParams.get('type')
  const isDirFilter = searchParams.get('isDir') === 'true'
  const isFavoritesView = viewType === 'favorites'
  const isRecycleBin = viewType === 'recycle'
  const isCollectionsView = viewType === 'collections'
  const isTypeFilter = !!fileType
  const canRead = hasPermission('file:read')
  const canWrite = hasPermission('file:write')
  const canShare = hasPermission('file:share')
  const scopedBrowse = isFavoritesView || isTypeFilter || isDirFilter
  const containerParentId = fileList.currentParentId || (scopedBrowse ? undefined : 'mnt:local')

  useEffect(() => {
    if (viewType !== 'recents' && viewType !== 'shares') return
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    const search = next.toString()
    navigate(`/w/${slug}/files${search ? `?${search}` : ''}`, { replace: true })
  }, [viewType, navigate, searchParams, slug])

  const specialViewTitle = useMemo(() => {
    if (isFavoritesView) return t('index.viewFavorites')
    if (isDirFilter) return t('index.viewFolder')
    if (fileType === 'document') return t('index.viewDocument')
    if (fileType === 'image') return t('index.viewImage')
    if (fileType === 'video') return t('index.viewVideo')
    if (fileType === 'audio') return t('index.viewAudio')
    if (fileType === 'other') return t('index.viewOther')
    return undefined
  }, [
    isFavoritesView,
    isDirFilter,
    fileType,
    t,
  ])

  // 判断文件夹
  const selectedFiles = fileList.fileList.filter((file) =>
    selectedKeys.includes(file.id)
  )
  const hasUnfavorited = selectedFiles.some((f) => !f.isFavorite)

  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditing =
        target?.matches('input, textarea, select') ||
        target?.isContentEditable ||
        Boolean(target?.closest('[contenteditable="true"]'))
      if (isEditing) return

      // ESC 键取消多选
      if (e.key === 'Escape' && selectedKeys.length > 0) {
        clearSelection()
      }

      if (
        canWrite &&
        matchShortcut(e, 'filesCopy') &&
        selectedFiles.length > 0
      ) {
        e.preventDefault()
        operations.copyToClipboard(selectedFiles)
      }

      if (
        canWrite &&
        matchShortcut(e, 'filesPaste') &&
        operations.clipboardItemCount > 0
      ) {
        e.preventDefault()
        void operations.handlePaste(fileList.currentParentId)
      }

      if (canWrite && matchShortcut(e, 'filesRename') && selectedKeys.length === 1) {
        e.preventDefault()
        const selectedFile = fileList.fileList.find(
          (file) => file.id === selectedKeys[0]
        )
        if (selectedFile) {
          operations.openRenameModal(selectedFile)
        }
      }

      if (canRead && matchShortcut(e, 'filesDownload') && selectedFiles.length > 0) {
        e.preventDefault()
        operations.handleDownload(selectedFiles)
      }

      if (canWrite && matchShortcut(e, 'filesDelete') && selectedFiles.length > 0) {
        e.preventDefault()
        operations.openBatchDeleteConfirm(selectedFiles)
      }

      if (canWrite && matchShortcut(e, 'filesNewFolder')) {
        e.preventDefault()
        operations.openCreateFolderModal()
      }

      if (canWrite && matchShortcut(e, 'filesFavorite') && selectedFiles.length > 0) {
        e.preventDefault()
        void operations.handleFavorite(selectedFiles)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedKeys,
    selectedFiles,
    fileList.fileList,
    fileList.currentParentId,
    canWrite,
    canRead,
    operations,
    matchShortcut,
  ])

  /**
   * 当目录变化时清空选中状态
   */
  useEffect(() => {
    clearSelection()
  }, [fileList.currentParentId, viewType, fileType, isDirFilter])

  /**
   * 监听文件上传完成事件
   */
  useEffect(() => {
    const handleUploadComplete = (event: Event) => {
      const customEvent = event as CustomEvent<{ parentId?: string }>
      const { parentId } = customEvent.detail

      // 如果是当前目录的文件，刷新列表
      if (parentId === fileList.currentParentId) {
        fileList.refresh()
      }
    }

    window.addEventListener('file-upload-complete', handleUploadComplete)

    return () => {
      window.removeEventListener('file-upload-complete', handleUploadComplete)
    }
  }, [fileList.currentParentId, fileList.refresh])

  // 上传在其他页面完成时，补偿文件页未监听到的完成事件。
  useEffect(() => {
    if (
      fileListRefreshVersion === 0 ||
      fileListRefreshVersion === lastHandledRefreshVersionRef.current
    ) {
      return
    }

    lastHandledRefreshVersionRef.current = fileListRefreshVersion
    const timer = window.setTimeout(() => {
      fileList.refresh()
    }, 500)

    return () => window.clearTimeout(timer)
  }, [fileListRefreshVersion, fileList.refresh])

  /**
   * 打开上传弹窗
   */
  const handleOpenUploadModal = () => {
    if (!canWrite) return
    setUploadDirectoryMode(false)
    setUploadModalOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('upload') !== '1' || !canWrite) return
    setUploadDirectoryMode(false)
    setUploadModalOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('upload')
    const query = next.toString()
    navigate(
      { pathname: `/w/${slug}/files`, search: query ? `?${query}` : '' },
      { replace: true }
    )
  }, [canWrite, navigate, searchParams, slug])

  /**
   * 打开上传文件夹弹窗
   */
  const handleOpenUploadDirectoryModal = () => {
    if (!canWrite) return
    setUploadDirectoryMode(true)
    setUploadModalOpen(true)
  }

  const handleOpenCollectionModal = (folder: FileItem) => {
    if (!canShare || !canWrite || !folder.isDir) return
    setCollectingFolder(folder)
    setCollectionModalOpen(true)
  }

  /**
   * 处理文件点击
   */
  const handleFileClick = (file: FileItem) => {
    if (file.isDir) {
      // 进入文件夹时清空选中状态
      clearSelection()

      // 如果是在特殊视图中，进入文件夹后清除筛选参数，回到全部文件
      if (isFavoritesView || isTypeFilter || isDirFilter) {
        // 使用 navigate 跳转到全部文件视图
        navigate(`/w/${slug}/files?parentId=${file.id}&viewMode=${viewMode}`)
      } else {
        fileList.enterFolder(file.id, viewMode)
      }
    }
  }

  /**
   * 全选/取消全选
   */
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(fileList.fileList.map((f) => f.id))
    } else {
      setSelectedKeys([])
    }
  }

  /**
   * 批量操作
   */
  const handleBatchDownload = () => {
    if (selectedFiles.length === 0) {
      toast.warning(t('index.toastNoDownload'))
      return
    }
    operations.handleDownload(selectedFiles)
    clearSelection()
  }

  const handleBatchCopy = () => {
    if (!canWrite || selectedFiles.length === 0) return
    operations.copyToClipboard(selectedFiles)
  }

  const handleBatchRename = () => {
    if (!canWrite) return
    if (selectedFiles.length !== 1) return
    operations.openRenameModal(selectedFiles[0])
  }

  const handleBatchDetail = () => {
    if (selectedFiles.length !== 1) return
    operations.openDetail(selectedFiles[0])
  }

  const handleBatchShare = () => {
    if (selectedFiles.length === 0) return
    operations.openBatchShareModal(selectedFiles)
  }

  const handleBatchCollect = () => {
    if (
      !canShare ||
      !canWrite ||
      selectedFiles.length !== 1 ||
      !selectedFiles[0].isDir
    ) {
      return
    }
    handleOpenCollectionModal(selectedFiles[0])
  }

  const handleBatchFavorite = async () => {
    if (!canWrite) return
    if (selectedFiles.length === 0) return
    await operations.handleFavorite(selectedFiles)
  }

  const handleBatchMove = () => {
    if (!canWrite) return
    if (selectedFiles.length === 0) return
    operations.openBatchMoveModal(selectedFiles)
  }

  const handleBatchDelete = () => {
    if (selectedFiles.length === 0) return
    operations.openBatchDeleteConfirm(selectedFiles)
  }

  /**
   * 拖拽移动文件
   */
  const handleMoveFiles = async (fileIds: string[], targetDirId: string) => {
    if (!canWrite) return
    await operations.handleMove(fileIds, targetDirId)
  }

  const acceptImDrop =
    canWrite && !isRecycleBin && !isCollectionsView
  const { save: saveImToWorkspace } = useSaveImToWorkspace(() => {
    void fileList.refresh()
  })
  const { save: saveMemoToFolder } = useSaveMemoToFolder(() => {
    void fileList.refresh()
  })
  const handleImportIm = async (
    item: { conversationId: string; messageId: number },
    targetDirId?: string
  ) => {
    try {
      await saveImToWorkspace(item, targetDirId ?? fileList.currentParentId)
    } catch (cause) {
      reportImSaveFailed(cause, t('index.saveFromChatFailed'))
    }
  }
  const handleImportMemo = async (
    memos: Parameters<typeof saveMemoToFolder>[0],
    targetDirId?: string
  ) => {
    try {
      await saveMemoToFolder(memos, targetDirId ?? fileList.currentParentId)
    } catch (cause) {
      reportMemoSaveFailed(cause, t('index.saveFromBoardFailed'))
    }
  }
  const { isOver: isImDropOver, dropProps: imDropProps } = useImMessageWorkspaceDrop(
    acceptImDrop,
    (item) => {
      void handleImportIm(item, fileList.currentParentId)
    },
    (memos) => {
      void handleImportMemo(memos, fileList.currentParentId)
    },
    true,
    'files-workspace-pane'
  )
  const dragKind = useDragState().kind

  /**
   * 拖到侧栏回收站删除后刷新列表。
   * ------------------------------------------------------------------
   * Dock 是布局层组件，不该反向依赖文件页的 store，所以用 CustomEvent 广播；
   * 谁在页面上谁刷新。kind === 'memo' 时不动文件列表（那是备忘录页的事）。
   */
  useEffect(() => {
    const onTrashDeleted = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string }>).detail
      if (detail?.kind !== 'file') return
      fileList.refresh()
      clearSelection?.()
    }
    window.addEventListener('alder:trash-deleted', onTrashDeleted)
    return () => window.removeEventListener('alder:trash-deleted', onTrashDeleted)
  }, [fileList, clearSelection])

  /**
   * 处理拖拽状态变化
   */
  const handleDragStateChange = (
    dropTargetName: string | null,
    draggedCount: number
  ) => {
    if (draggedCount > 0) {
      if (!dragAnchorRef.current) {
        dragAnchorRef.current = {
          parentId: fileList.currentParentId,
          files: fileList.fileList,
        }
      }
    } else {
      dragAnchorRef.current = null
    }
    setDragTargetName(dropTargetName)
    setDraggedCount(draggedCount)
  }

  const isAllSelected =
    fileList.fileList.length > 0 &&
    selectedKeys.length === fileList.fileList.length

  /**
   * 左栏树导航：普通视图复用 fileList.navigateToFolder（与面包屑一致）；
   * 特殊视图与 handleFileClick 的 scoped 分支保持同样的回退 URL。
   */
  const handleTreeNavigate = (folderId?: string) => {
    if (scopedBrowse) {
      navigate(
        `/w/${slug}/files?${folderId ? `parentId=${folderId}&` : ''}viewMode=${viewMode}`
      )
      return
    }
    fileList.navigateToFolder(folderId)
  }

  const treeRootActive =
    !scopedBrowse && fileList.breadcrumbPath.length === 0
  const treeActivePathId =
    !scopedBrowse && fileList.breadcrumbPath.length > 0
      ? fileList.breadcrumbPath[fileList.breadcrumbPath.length - 1].id
      : undefined
  const treeSubFolders = fileList.fileList.filter((file) => file.isDir)

  const treeViewEntries: FolderTreeViewEntry[] = [
    {
      id: 'favorites',
      label: t('index.viewFavorites'),
      active: isFavoritesView,
      onClick: () =>
        navigate(`/w/${slug}/files?view=favorites&viewMode=${viewMode}`),
    },
    ...(canShare
      ? [
          {
            id: 'collections',
            label: tLayout('sidebar.nav.collections'),
            active: false,
            onClick: () => navigate(`/w/${slug}/files?view=collections`),
          },
        ]
      : []),
    ...(canWrite
      ? [
          {
            id: 'recycle',
            label: t('recycle.title'),
            active: false,
            onClick: () => navigate(`/w/${slug}/files?view=recycle`),
          },
        ]
      : []),
  ]

  // 单选某个文件/文件夹时，右栏 Inspector 滑出展示详情
  const inspectorFile = selectedFiles.length === 1 ? selectedFiles[0] : null

  // 如果是回收站或我的分享视图,显示对应的特殊组件
  if (isRecycleBin) {
    if (!canWrite) return <NoPermission />
    return <RecycleBinView />
  }

  if (viewType === 'recents' || viewType === 'shares') {
    return null
  }

  if (isCollectionsView) {
    if (!canShare) return <NoPermission />
    return <MyCollectionsView />
  }

  if (!canRead) {
    return <NoPermission />
  }

  const currentFolderName =
    fileList.breadcrumbPath.length > 0
      ? fileList.breadcrumbPath[fileList.breadcrumbPath.length - 1].name
      : ''
  const pageTitle = currentFolderName || specialViewTitle || t('breadcrumb.allFiles')

  return (
    <div className='flex h-full flex-col'>
      {/*
        demo 基准：文件页同样是「页头 + 工作区」两段。
        页头用 .a-phead（eyebrow / h1 / sub），视图切换放在右侧 ——
        原先这段是塞在面板内部顶栏里的，所以整页看起来没有标题层级。
      */}
      <header className='a-phead mb-4'>
        <div className='min-w-0'>
          {/* demo 的分工：eyebrow 是「哪个区」，h1 是「当前在哪」 */}
          <p className='a-eyebrow'>文件</p>
          <h1 className='truncate'>{pageTitle}</h1>
          <p className='a-sub'>{t('index.totalCount', { total: fileList.total })}</p>
        </div>
        <div className='a-phead__right'>
          {/* demo 的液态胶囊分段控件：灰轨道 + 选中项自带白色滑块与描边 */}
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            items={[
              {
                value: 'grid',
                ariaLabel: t('index.ariaGrid'),
                label: (
                  <>
                    <Grid2X2 className='size-3.5' strokeWidth={1.75} />
                    {t('index.ariaGrid')}
                  </>
                ),
              },
              {
                value: 'list',
                ariaLabel: t('index.ariaList'),
                label: (
                  <>
                    <List className='size-4' strokeWidth={1.75} />
                    {t('index.ariaList')}
                  </>
                ),
              },
            ]}
          />
          <Button
            type='button'
            className='a-btn a-btn--primary'
            onClick={handleOpenUploadModal}
          >
            <Upload strokeWidth={1.9} />
            {t('index.uploadFile')}
          </Button>
        </div>
      </header>

      <div className='fs-grid grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[repeat(12,minmax(0,1fr))]'>
        <FolderTree
          pathItems={fileList.breadcrumbPath}
          subFolders={treeSubFolders}
          rootActive={treeRootActive}
          activePathId={treeActivePathId}
          rootFolderId={fileList.breadcrumbPath[0]?.id ?? fileList.currentParentId}
          onRootClick={() => handleTreeNavigate()}
          onPathClick={(folderId) => handleTreeNavigate(folderId)}
          onFolderClick={handleFileClick}
          viewEntries={treeViewEntries}
          rootCount={scopedBrowse ? undefined : fileList.total}
          onMove={handleMoveFiles}
          onImportIm={handleImportIm}
          onImportMemo={handleImportMemo}
        />

        <div className='fs-content flex min-h-0 min-w-0 flex-1 gap-4'>
          {/*
            demo 的中间列不是一张包住全部内容的大玻璃卡：
            工具条直接落在页面底上，文件网格悬浮其上。
            这里只改外层 className（去掉 glass-card），DOM 结构与逻辑不动。
          */}
          <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
            {/*
              demo「空间资产库」的顶部行：左侧是标题 + 描述，右侧才是控件。
              这里左半留给面包屑（有层级时才出现），右半是搜索 + 胶囊按钮组。
            */}
            <div className='fs-cardhead flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5'>
              {dragKind === 'memo' ? (
                <p className='order-last w-full text-[12.5px] font-medium text-primary'>
                  {t('index.dropFromBoardHint')}
                </p>
              ) : null}
              <SidebarTrigger className='shrink-0 md:hidden' />

              <div className='min-w-0 flex-1'>
                {/*
                  根目录的「全部文件」/特殊视图标题已由页头 h1 承担，
                  这里只在真的有层级路径时渲染面包屑，避免同一行出现两遍同样的字。
                */}
                {fileList.breadcrumbPath.length > 0 && (
                  <FileBreadcrumb
                    breadcrumbPath={fileList.breadcrumbPath}
                    onNavigate={fileList.navigateToFolder}
                  />
                )}
              </div>

              <Toolbar
                searchKeyword={fileList.searchInput}
                onSearchChange={fileList.setSearchInput}
                onSearch={fileList.commitSearch}
                onUpload={handleOpenUploadModal}
                onUploadDirectory={handleOpenUploadDirectoryModal}
                onCreateFolder={operations.openCreateFolderModal}
                onRefresh={fileList.refresh}
                onPaste={() => operations.handlePaste(fileList.currentParentId)}
                clipboardItemCount={operations.clipboardItemCount}
                pasting={operations.pasting}
                hideActions={false}
                hideUpload
              />
            </div>

            {/* 计数行 + 右侧胶囊控件组（排序 / 方向 / 双窗口） */}
            <div className='flex flex-wrap items-center justify-between gap-3 px-4 pb-3 sm:px-5'>
        <div className='flex items-center gap-3'>
          {viewMode === 'grid' && fileList.fileList.length > 0 && (
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              aria-label={t('index.ariaSelectAll')}
            />
          )}
          <span className='font-mono text-[11.5px] tabular-nums tracking-wide text-text-muted'>
            {selectedKeys.length > 0
              ? t('index.selectedCount', { count: selectedKeys.length })
              : t('index.totalCount', { total: fileList.total })}
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          <Select
            value={fileList.orderBy}
            onValueChange={(field) =>
              fileList.handleSortChange(field, fileList.orderDirection)
            }
          >
            <SelectTrigger
              className='a-btn a-btn--sm a-btn--ghost w-auto gap-1.5 border-0 text-text-secondary shadow-none'
              size='sm'
              aria-label={t('sort.fieldAria')}
            >
              <ArrowUpDown className='size-3.5 text-text-muted' strokeWidth={1.9} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value='displayName'>{t('sort.name')}</SelectItem>
              <SelectItem value='updateTime'>{t('sort.modified')}</SelectItem>
              <SelectItem value='suffix'>{t('sort.type')}</SelectItem>
              <SelectItem value='size'>{t('sort.size')}</SelectItem>
            </SelectGroup>
</SelectContent>
          </Select>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-8 shrink-0 rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground'
            onClick={() =>
              fileList.handleSortChange(
                fileList.orderBy,
                fileList.orderDirection === 'ASC' ? 'DESC' : 'ASC'
              )
            }
            aria-label={
              fileList.orderDirection === 'ASC'
                ? t('sort.ascending')
                : t('sort.descending')
            }
            title={
              fileList.orderDirection === 'ASC'
                ? t('sort.ascending')
                : t('sort.descending')
            }
          >
            {fileList.orderDirection === 'ASC' ? (
              <ArrowUp className='size-4' strokeWidth={1.9} />
            ) : (
              <ArrowDown className='size-4' strokeWidth={1.9} />
            )}
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={cn(
              'size-8 shrink-0 rounded-full transition-colors',
              dualOpen
                ? 'bg-accent-soft text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-foreground'
            )}
            aria-pressed={dualOpen}
            aria-label={t('toolbar.dualWindow')}
            title={t('toolbar.dualWindow')}
            onClick={() => {
              if (dualOpen) {
                setDualOpen(false)
                return
              }
              setPeerParentId(fileList.currentParentId)
              setPeerSession((session) => session + 1)
              setDualOpen(true)
            }}
          >
            <Columns2 className='size-4' strokeWidth={1.9} />
          </Button>
        </div>
      </div>

      {!scopedBrowse && (
        <StorageMountBar
          activeId={fileList.breadcrumbPath[0]?.id}
          currentParentId={fileList.currentParentId}
          onOpen={fileList.navigateToFolder}
          onMove={handleMoveFiles}
          onImportIm={handleImportIm}
          onImportMemo={handleImportMemo}
        />
      )}

      {/* 主内容区域 */}
      <div className='min-h-0 flex-1 overflow-hidden'>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={fileScrollAreaRef}
              /*
                ⚠️ 去掉原来的 `isImDropOver && 'rounded-[10px] ring-2 ring-primary/40'`。
                那只是一个内描边，和聊天窗/备忘录/AI 面板的落点提示不是一套视觉。
                改用全局共用的 <DropOverlay>（见下面的绝对定位那一层）：
                虚线框 + 玻璃底 + 按拖拽种类换图标 + scale 入场，三面板完全一致。
                relative 是 DropOverlay 定位所需的锚。
              */
              className='relative h-full overflow-auto px-4 pt-1 pb-8 sm:px-5'
              {...imDropProps}
              onDragOver={(event) => {
                imDropProps.onDragOver(event)
                if (event.defaultPrevented) return
                if (!Array.from(event.dataTransfer.types).includes('application/json')) return
                const anchor = dragAnchorRef.current
                if (
                  !fileList.currentParentId ||
                  (anchor && anchor.parentId === fileList.currentParentId)
                ) {
                  return
                }
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                imDropProps.onDrop(event)
                if (event.defaultPrevented) return
                const target = event.target as HTMLElement
                if (target.closest('[data-file-id]')) return
                const anchor = dragAnchorRef.current
                if (
                  !fileList.currentParentId ||
                  (anchor && anchor.parentId === fileList.currentParentId)
                ) {
                  return
                }
                const raw = event.dataTransfer.getData('application/json')
                if (!raw) return
                event.preventDefault()
                try {
                  const ids = JSON.parse(raw) as string[]
                  if (Array.isArray(ids) && ids.length > 0) {
                    void handleMoveFiles(ids, fileList.currentParentId)
                    playLandBounce(event.currentTarget)
                  }
                } catch {
                  // 不是文件拖拽
                }
              }}
              onClick={(e) => {
                const tgt = e.target as HTMLElement
                if (tgt.closest('[data-file-id]')) return
                if (tgt.closest('thead')) return
                if (tgt.closest('button')) return
                clearSelection()
              }}
            >
              {/*
                统一落点提示：从聊天/备忘录拖过来时覆盖整个文件区。
                文案是「松开会发生什么」，图标随拖拽种类自动切换。
              */}
              <DropOverlay
                active={isImDropOver && dragKind !== 'memo'}
                label={t('index.dropFromChat')}
              />
              {(() => {
                const anchor = dragAnchorRef.current
                const dragSplit =
                  anchor != null && anchor.parentId !== fileList.currentParentId
                const sourceFiles = dragSplit ? anchor.files : fileList.fileList
                const renderFiles = (items: FileItem[], trackDrag: boolean) =>
                  viewMode === 'grid' ? (
                    <FileGridView
                      fileList={items}
                      selectedKeys={selectedKeys}
                      onSelectionChange={setSelectedKeys}
                      onFileClick={handleFileClick}
                      onDownload={operations.handleDownload}
                      onCopy={operations.copyToClipboard}
                      onShare={operations.openShareModal}
                      onCollect={canShare && canWrite ? handleOpenCollectionModal : undefined}
                      onDelete={operations.openDeleteConfirm}
                      onRename={operations.openRenameModal}
                      onMove={operations.openMoveModal}
                      onMoveFiles={handleMoveFiles}
                      onImportIm={handleImportIm}
                      onImportMemo={handleImportMemo}
                      onFavorite={operations.handleFavorite}
                      onPreview={(file) => operations.openPreview(file, items)}
                      onAiEdit={openOfficeEdit}
                      onDetail={operations.openDetail}
                      onDragStateChange={trackDrag ? handleDragStateChange : undefined}
                      onBatchShare={handleBatchShare}
                      onBatchCopy={handleBatchCopy}
                      onBatchMove={handleBatchMove}
                      onBatchDelete={handleBatchDelete}
                      hasMore={trackDrag ? fileList.hasMore : false}
                      loadingMore={trackDrag ? fileList.loadingMore : false}
                      onLoadMore={trackDrag ? fileList.loadMore : undefined}
                      scrollRootRef={fileScrollAreaRef}
                    />
                  ) : (
                    <FileListView
                      fileList={items}
                      selectedKeys={selectedKeys}
                      onSelectionChange={setSelectedKeys}
                      onFileClick={handleFileClick}
                      orderBy={fileList.orderBy}
                      orderDirection={fileList.orderDirection}
                      onSortChange={fileList.handleSortChange}
                      onDownload={operations.handleDownload}
                      onCopy={operations.copyToClipboard}
                      onShare={operations.openShareModal}
                      onCollect={canShare && canWrite ? handleOpenCollectionModal : undefined}
                      onDelete={operations.openDeleteConfirm}
                      onRename={operations.openRenameModal}
                      onMove={operations.openMoveModal}
                      onMoveFiles={handleMoveFiles}
                      onImportIm={handleImportIm}
                      onImportMemo={handleImportMemo}
                      onFavorite={operations.handleFavorite}
                      onPreview={(file) => operations.openPreview(file, items)}
                      onAiEdit={openOfficeEdit}
                      onDetail={operations.openDetail}
                      onDragStateChange={trackDrag ? handleDragStateChange : undefined}
                      onBatchShare={handleBatchShare}
                      onBatchCopy={handleBatchCopy}
                      onBatchMove={handleBatchMove}
                      onBatchDelete={handleBatchDelete}
                      hasMore={trackDrag ? fileList.hasMore : false}
                      loadingMore={trackDrag ? fileList.loadingMore : false}
                      onLoadMore={trackDrag ? fileList.loadMore : undefined}
                      scrollRootRef={fileScrollAreaRef}
                    />
                  )
                const renderPane = (items: FileItem[], loading: boolean, trackDrag: boolean) =>
                  loading ? (
                    <FileLibrarySkeleton variant={viewMode} rows={viewMode === 'grid' ? 10 : 8} />
                  ) : items.length === 0 ? (
                    <div className='flex h-full items-center justify-center'>
                      <Empty className='border-none'>
                        <EmptyHeader className='tech-rise gap-3'>
                          <EmptyMedia variant='icon' className='bg-accent-soft text-primary'>
                            <FileText className='h-12 w-12' />
                          </EmptyMedia>
                          <EmptyTitle className='text-[15px] font-semibold tracking-tight'>{t('index.emptyTitle')}</EmptyTitle>
                          <EmptyDescription className='max-w-prose text-[13.5px] leading-relaxed text-muted-foreground'>{t('index.emptyDesc')}</EmptyDescription>
                        </EmptyHeader>
                        {!fileList.searchKeyword && (
                          <EmptyContent>
                            <div className='flex gap-2'>
                              {canWrite && (
                                <Button
                                  size='sm'
                                  className='a-btn a-btn--sm a-btn--primary'
                                  onClick={handleOpenUploadModal}
                                >
                                  <Upload className='mr-2 h-4 w-4' />
                                  {t('index.uploadFile')}
                                </Button>
                              )}
                              {canWrite && (
                                <Button
                                  variant='outline'
                                  size='sm'
                                  className='a-btn a-btn--sm a-btn--ghost'
                                  onClick={operations.openCreateFolderModal}
                                >
                                  <FolderPlus className='mr-2 h-4 w-4' />
                                  {t('index.newFolder')}
                                </Button>
                              )}
                            </div>
                          </EmptyContent>
                        )}
                      </Empty>
                    </div>
                  ) : (
                    <div className='h-full min-h-0'>{renderFiles(items, trackDrag)}</div>
                  )
                return (
                  <>
                    {dragSplit && (
                      <div key='live' className='relative z-10 min-h-full'>
                        {renderPane(fileList.fileList, fileList.loading, false)}
                      </div>
                    )}
                    <div
                      key='source'
                      className={
                        dragSplit
                          ? 'pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-0'
                          : 'min-h-full'
                      }
                    >
                      {renderPane(sourceFiles, !dragSplit && fileList.loading, true)}
                    </div>
                  </>
                )
              })()}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
<ContextMenuGroup>
            {canWrite && (
              <ContextMenuItem onClick={operations.openCreateFolderModal}>
                <FolderPlus className='mr-2 h-4 w-4' />
                {t('index.newFolder')}
              </ContextMenuItem>
            )}
            {canWrite && (
              <ContextMenuItem onClick={handleOpenUploadModal}>
                <Upload className='mr-2 h-4 w-4' />
                {t('index.uploadFile')}
              </ContextMenuItem>
            )}
            {canWrite && (
              <ContextMenuItem onClick={handleOpenUploadDirectoryModal}>
                <FolderUp className='mr-2 h-4 w-4' />
                {t('index.uploadFolder')}
              </ContextMenuItem>
            )}
            {canWrite && operations.clipboardItemCount > 0 && (
              <ContextMenuItem
                disabled={operations.pasting}
                onClick={() => operations.handlePaste(fileList.currentParentId)}
              >
                <ClipboardPaste className='mr-2 h-4 w-4' />
                {t('toolbar.paste', {
                  count: operations.clipboardItemCount,
                })}
              </ContextMenuItem>
            )}
            {canWrite && (
              <ContextMenuSeparator />
            )}
            <ContextMenuItem onClick={() => fileList.refresh()}>
              <RefreshCw className='mr-2 h-4 w-4' />
              {t('index.refresh')}
            </ContextMenuItem>
          </ContextMenuGroup>
</ContextMenuContent>
        </ContextMenu>
      </div>
          </div>

          {dualOpen && (
            <FilePeerPane
              key={peerSession}
              initialParentId={peerParentId}
              onClose={() => setDualOpen(false)}
              onMoveFiles={handleMoveFiles}
              onImportIm={handleImportIm}
              onImportMemo={handleImportMemo}
              onRefreshReady={bindPeerRefresh}
              onDownload={operations.handleDownload}
              onCopy={operations.copyToClipboard}
              onShare={operations.openShareModal}
              onDelete={operations.openDeleteConfirm}
              onRename={operations.openRenameModal}
              onMove={operations.openMoveModal}
              onFavorite={operations.handleFavorite}
              onPreview={(file, list) => operations.openPreview(file, list)}
              onAiEdit={openOfficeEdit}
              onDetail={operations.openDetail}
            />
          )}
        </div>

      </div>

      {inspectorFile ? (
        <FileInspector
          file={inspectorFile}
          breadcrumbPath={fileList.breadcrumbPath}
          onClose={clearSelection}
          canRead={canRead}
          canWrite={canWrite}
          canShare={canShare}
          onPreview={(file) => operations.openPreview(file, fileList.fileList)}
          onAiEdit={openOfficeEdit}
          onShare={operations.openShareModal}
          onCollect={
            canShare && canWrite ? handleOpenCollectionModal : undefined
          }
          onDownload={operations.handleDownload}
          onCopy={operations.copyToClipboard}
          onMove={operations.openMoveModal}
          onRename={operations.openRenameModal}
          onFavorite={operations.handleFavorite}
          onDelete={operations.openDeleteConfirm}
          onDetail={operations.openDetail}
        />
      ) : null}

      {/* 拖拽移动提示：fixed 底部，避免插入文档流导致布局抖动 */}
      {dragTargetName && (
        <div
          className={cn(
            'pointer-events-none fixed left-1/2 z-[90] -translate-x-1/2 rounded-full border border-primary/40 bg-card px-4 py-2 shadow-md',
            selectedKeys.length > 0 ? 'bottom-24' : 'bottom-6'
          )}
          role='status'
          aria-live='polite'
        >
          <div className='flex items-center gap-2 text-[13px] text-foreground'>
            <svg
              className='h-4 w-4 shrink-0 text-hud'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 7l5 5m0 0l-5 5m5-5H6'
              />
            </svg>
            <span>
              {t('index.dragMoveTo', { name: dragTargetName })}{' '}
              {draggedCount > 1 &&
                t('index.dragMoveToMulti', { count: draggedCount })}
            </span>
          </div>
        </div>
      )}

      <FileBulkSelectionBar
        selectedCount={selectedKeys.length}
        hasUnfavorited={hasUnfavorited}
        onDownload={handleBatchDownload}
        onCopy={handleBatchCopy}
        onRename={handleBatchRename}
        onDetail={handleBatchDetail}
        onShare={handleBatchShare}
        onCollect={
          selectedFiles.length === 1 && selectedFiles[0].isDir
            ? handleBatchCollect
            : undefined
        }
        onFavorite={handleBatchFavorite}
        onMove={handleBatchMove}
        onDelete={handleBatchDelete}
        onClear={clearSelection}
      />

      {/* 上传弹窗 */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        parentId={containerParentId}
        isDirectoryMode={uploadDirectoryMode}
      />

      {/* 上传进度面板 */}
      <UploadPanel onSuccess={fileList.refresh} />

      {/* 文件夹下载进度面板 */}
      <FolderDownloadPanel
        tasks={operations.folderDownloadTasks}
        onDismiss={operations.dismissFolderDownloadTask}
        onCancel={operations.cancelFolderDownloadTask}
      />

      {/* 模态框 */}
      <CreateFolderModal
        open={operations.createFolderModalVisible}
        onOpenChange={operations.setCreateFolderModalVisible}
        parentId={containerParentId}
        onConfirm={operations.handleCreateFolder}
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
        onRefresh={fileList.refresh}
      />

      <ShareModal
        open={operations.shareModalVisible}
        onOpenChange={operations.setShareModalVisible}
        file={operations.sharingFile}
        files={operations.sharingFiles}
        onSuccess={clearSelection}
      />

      <CreateCollectionModal
        open={collectionModalOpen}
        onOpenChange={setCollectionModalOpen}
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
        breadcrumbPath={fileList.breadcrumbPath}
      />
    </div>
  )
}
