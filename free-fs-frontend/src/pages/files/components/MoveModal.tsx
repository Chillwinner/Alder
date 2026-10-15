/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import type { Workspace } from '@/types/workspace'
import { Home, FolderPlus, Check, X } from 'lucide-react'
import FolderIconSvg from '../../../../public/fi/folder'
import { toast } from 'sonner'
import { getFolders, createFolder } from '@/api/file'
import { workspaceApi } from '@/api/workspace'
import type { WorkspaceScopedRequest } from '@/api/workspace-scope'
import { getCurrentWorkspaceId, useWorkspaceStore } from '@/store/workspace'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { FileIcon } from '@/components/file-icon'

interface MoveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileItem | null
  files: FileItem[]
  onConfirm: (
    fileIds: string[],
    targetDirId: string,
    scope?: WorkspaceScopedRequest
  ) => Promise<void>
  onRefresh?: () => void
  /** 仅选择目标目录（无待移动文件） */
  pickFolderMode?: boolean
  /** 保存到空间等场景：先选目标工作空间 */
  allowWorkspacePick?: boolean
  dialogTitle?: string
  confirmText?: string
}

export function MoveModal({
  open,
  onOpenChange,
  file,
  files,
  onConfirm,
  onRefresh,
  pickFolderMode = false,
  allowWorkspacePick = false,
  dialogTitle,
  confirmText,
}: MoveModalProps) {
  const { t } = useTranslation('files')
  const { t: tShare } = useTranslation('share')
  const [loading, setLoading] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [storagePlatformId, setStoragePlatformId] = useState<string | null>(
    null
  )
  const [folders, setFolders] = useState<FileItem[]>([])
  const [breadcrumbPath, setBreadcrumbPath] = useState<FileItem[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [currentParentId, setCurrentParentId] = useState<string | undefined>(
    undefined
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const movingFiles = file ? [file] : files
  const excludeFolderIds = useMemo(
    () => new Set(movingFiles.map((f) => f.id)),
    [file, files]
  )

  const folderScope = useMemo((): WorkspaceScopedRequest | undefined => {
    if (!allowWorkspacePick || !selectedWorkspaceId) return undefined
    return {
      workspaceId: selectedWorkspaceId,
      storagePlatformId,
    }
  }, [allowWorkspacePick, selectedWorkspaceId, storagePlatformId])

  const loadFolders = async (parentId?: string, scopeOverride?: WorkspaceScopedRequest) => {
    const scope = scopeOverride ?? folderScope
    if (allowWorkspacePick && !scope?.workspaceId) {
      setFolders([])
      return
    }
    setLoading(true)
    try {
      const response = await getFolders(parentId, scope)
      setFolders(
        response.filter((folder) => !excludeFolderIds.has(folder.id))
      )
    } finally {
      setLoading(false)
    }
  }

  const resetFolderNav = () => {
    setBreadcrumbPath([])
    setCurrentParentId(undefined)
    setSelectedFolderId('')
    setIsCreatingFolder(false)
    setNewFolderName('')
  }

  // 选择文件夹
  const selectFolder = (folder: FileItem) => {
    setSelectedFolderId(folder.id)
  }

  // 进入文件夹（双击）
  const enterFolder = (folder: FileItem) => {
    setBreadcrumbPath([...breadcrumbPath, folder])
    setCurrentParentId(folder.id)
    setSelectedFolderId('')
    loadFolders(folder.id)
  }

  // 打开创建文件夹输入框
  const handleCreateFolder = () => {
    setIsCreatingFolder(true)
    setNewFolderName('')
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  // 确认创建文件夹
  const confirmCreateFolder = async () => {
    const folderName = newFolderName.trim()
    if (!folderName) {
      toast.warning(t('move.toastName'))
      return
    }

    try {
      await createFolder(
        {
          folderName,
          parentId: currentParentId,
        },
        folderScope
      )
      toast.success(t('move.toastMkdirOk'))
      setIsCreatingFolder(false)
      setNewFolderName('')
      loadFolders(currentParentId)
      onRefresh?.()
    } finally {
      // 无需处理
    }
  }

  // 取消创建文件夹
  const cancelCreateFolder = () => {
    setIsCreatingFolder(false)
    setNewFolderName('')
  }

  // 处理输入框按键
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirmCreateFolder()
    } else if (e.key === 'Escape') {
      cancelCreateFolder()
    }
  }

  // 通过面包屑导航
  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // 返回根目录
      setBreadcrumbPath([])
      setCurrentParentId(undefined)
      setSelectedFolderId('')
      loadFolders(undefined)
    } else {
      // 返回到指定层级
      const newPath = breadcrumbPath.slice(0, index + 1)
      setBreadcrumbPath(newPath)
      setCurrentParentId(newPath[index].id)
      setSelectedFolderId('')
      loadFolders(newPath[index].id)
    }
  }

  // 确认移动
  const handleConfirm = async () => {
    const targetDirId = selectedFolderId || currentParentId || ''

    setIsSubmitting(true)
    try {
      await onConfirm(
        movingFiles.map((f) => f.id),
        targetDirId,
        folderScope
      )
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open || !allowWorkspacePick) return
    let cancelled = false
    setWorkspacesLoading(true)
    ;(async () => {
      try {
        let list = useWorkspaceStore.getState().workspaces
        if (list.length === 0) {
          list = await workspaceApi.list()
        }
        if (cancelled) return
        setWorkspaces(list)
        const currentId = getCurrentWorkspaceId()
        const preferred =
          currentId && list.some((w) => w.id === currentId)
            ? currentId
            : (list[0]?.id ?? '')
        setSelectedWorkspaceId(preferred)
      } finally {
        if (!cancelled) setWorkspacesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, allowWorkspacePick])

  useEffect(() => {
    if (!open || !allowWorkspacePick || !selectedWorkspaceId) return
    let cancelled = false
    resetFolderNav()
    setStoragePlatformId(null)
    ;(async () => {
      if (cancelled) return
      const scope: WorkspaceScopedRequest = {
        workspaceId: selectedWorkspaceId,
      }
      setLoading(true)
      try {
        const response = await getFolders(undefined, scope)
        if (cancelled) return
        setFolders(
          response.filter((folder) => !excludeFolderIds.has(folder.id))
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, allowWorkspacePick, selectedWorkspaceId, excludeFolderIds])

  useEffect(() => {
    if (!open || allowWorkspacePick) return
    resetFolderNav()
    void loadFolders(undefined)
    // 仅随弹窗打开初始化目录树
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowWorkspacePick])

  // 检查是否移动到当前所在目录
  const targetDirId = selectedFolderId || currentParentId || ''
  const isSameDirectory =
    !pickFolderMode &&
    movingFiles.every((file) => {
      const fileParentId = file.parentId || ''
      return fileParentId === targetDirId
    })

  const isAtMountRoot = breadcrumbPath.length === 0 && !currentParentId
  const isOkDisabled =
    (allowWorkspacePick && (!selectedWorkspaceId || workspacesLoading)) ||
    (!selectedFolderId && breadcrumbPath.length > 0) ||
    (isAtMountRoot && !selectedFolderId) ||
    isSameDirectory

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[85vh] sm:max-w-2xl overflow-y-auto'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle ?? t('move.title')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6'>
          {allowWorkspacePick ? (
            <div className='flex flex-col gap-2'>
              <p className='text-sm font-medium text-foreground'>
                {tShare('saveToWorkspace.workspace')}
              </p>
              <Select
                value={selectedWorkspaceId}
                onValueChange={setSelectedWorkspaceId}
                disabled={workspacesLoading || workspaces.length === 0}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue
                    placeholder={tShare('saveToWorkspace.workspacePlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
</SelectContent>
              </Select>
            </div>
          ) : null}
          {/* 面包屑导航 */}
          <div className='flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[13px]'>
            <button
              type='button'
              className={cn(
                'flex items-center gap-1 transition-colors outline-none hover:text-primary focus:outline-none',
                breadcrumbPath.length === 0 &&
                  'cursor-default font-medium text-foreground'
              )}
              onClick={() =>
                breadcrumbPath.length > 0 && navigateToBreadcrumb(-1)
              }
              tabIndex={-1}
            >
              <Home className='h-4 w-4' />
              <span>{t('breadcrumb.allFiles')}</span>
            </button>
            {breadcrumbPath.map((folder, index) => (
              <div key={folder.id} className='flex items-center gap-2'>
                <span className='text-muted-foreground'>/</span>
                <button
                  type='button'
                  className={cn(
                    'flex items-center gap-1 transition-colors outline-none hover:text-primary focus:outline-none',
                    index === breadcrumbPath.length - 1 &&
                      'cursor-default font-medium text-foreground'
                  )}
                  onClick={() =>
                    index < breadcrumbPath.length - 1 &&
                    navigateToBreadcrumb(index)
                  }
                  tabIndex={-1}
                >
                  <FolderIconSvg size={16} />
                  <span>{folder.displayName}</span>
                </button>
              </div>
            ))}
          </div>

          {/* 文件夹列表 */}
          <div className='max-h-[400px] min-h-[300px] overflow-y-auto rounded-lg border border-border bg-surface-secondary'>
            {loading ? (
              <div className='flex h-[300px] items-center justify-center'>
                <p className='font-mono text-xs tracking-wider text-muted-foreground uppercase'>{t('move.loading')}</p>
              </div>
            ) : folders.length === 0 && !isCreatingFolder ? (
              <div className='flex h-[300px] flex-col items-center justify-center text-muted-foreground'>
                <FolderIconSvg size={48} className='mb-3 opacity-50' />
                <p className='text-[13.5px]'>{t('move.emptyFolders')}</p>
              </div>
            ) : (
              <div className='flex flex-col p-2 gap-0.5'>
                {/* 新建文件夹输入框 */}
                {isCreatingFolder && (
                  <div
                    className='flex items-center justify-between gap-3 rounded border border-primary bg-background px-3 py-2.5'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className='flex flex-1 items-center gap-3'>
                      <div className='h-5 w-5 flex items-center justify-center overflow-hidden'>
                        <FileIcon
                          type='dir'
                          size={20}
                          className='flex-shrink-0'
                        />
                      </div>
                      <input
                        ref={inputRef}
                        type='text'
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={t('move.mkdirPlaceholder')}
                        className='flex-1 border-none bg-transparent text-sm outline-none focus:outline-none'
                        maxLength={50}
                      />
                    </div>
                    <div className='flex items-center gap-1'>
                      <button
                        onClick={confirmCreateFolder}
                        className='rounded p-1.5 text-primary transition-colors hover:bg-primary/10'
                        title={t('move.confirmMkdir')}
                      >
                        <Check className='h-4 w-4' />
                      </button>
                      <button
                        onClick={cancelCreateFolder}
                        className='rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted-foreground/10'
                        title={t('move.cancelMkdir')}
                      >
                        <X className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                )}

                {/* 现有文件夹列表 */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 transition-colors duration-150 select-none',
                      'hover:bg-surface-hover',
                      selectedFolderId === folder.id &&
                        'bg-accent-soft font-medium text-primary'
                    )}
                    onClick={() => selectFolder(folder)}
                    onDoubleClick={() => enterFolder(folder)}
                  >
                    <div className='h-5 w-5 flex items-center justify-center overflow-hidden'>
                      <FileIcon type='dir' size={20} className='flex-shrink-0' />
                    </div>
                    <span className='flex-1 truncate text-sm'>
                      {folder.displayName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提示信息 */}
          {isSameDirectory ? (
            <div className='flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[13px] text-foreground'>
              <svg
                className='mt-0.5 h-4 w-4 flex-shrink-0 text-warning'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                  clipRule='evenodd'
                />
              </svg>
              <span>{t('move.hintSameDir')}</span>
            </div>
          ) : (
            <div className='flex items-start gap-2 rounded-lg border border-border bg-surface-secondary p-3 text-[13px] text-text-secondary'>
              <svg
                className='mt-0.5 h-4 w-4 flex-shrink-0 text-hud'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                  clipRule='evenodd'
                />
              </svg>
              <span>{t('move.hintSelect')}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='ghost'
            onClick={handleCreateFolder}
            className='mr-auto'
          >
            <FolderPlus className='mr-2 h-4 w-4' />
            {t('createFolder.title')}
          </Button>
          <DialogClose asChild>
            <Button variant='outline' disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || isOkDisabled}
          >
            {isSubmitting
              ? t('move.submitting')
              : (confirmText ?? t('move.submit'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
