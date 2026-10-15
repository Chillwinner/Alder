/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem } from '@/types/file'
import type { FolderDownloadTaskVO } from '@/types/transfer'
import { toast } from 'sonner'
import {
  deleteFiles,
  renameFile,
  moveFiles,
  copyFiles,
  createFolder,
  favoriteFile,
  unfavoriteFile,
  getFileAccessUrl,
  getFileContent,
} from '@/api/file'
import { probeDirectUrl } from '@/utils/probe-direct-url'
import {
  cancelFolderDownloadTask as requestCancelFolderDownloadTask,
  createFolderDownloadTask,
  getFolderDownloadTask,
} from '@/api/transfer'
import { fileTileOrigin, openFilePreview } from '@/utils/preview'
import { getCurrentWorkspaceId, useWorkspaceStore } from '@/store/workspace'

export type FolderDownloadPanelTask = FolderDownloadTaskVO & {
  downloadStarted?: boolean
}

const FOLDER_DOWNLOAD_STORAGE_KEY = 'free-fs-folder-download-tasks'
const FILE_COPY_CLIPBOARD_STORAGE_KEY = 'free-fs-file-copy-clipboard'
const FOLDER_DOWNLOAD_START_GAP_MS = 1500

type FileCopyClipboard = {
  workspaceId: string
  items: Array<Pick<FileItem, 'id' | 'displayName' | 'isDir'>>
  copiedAt: number
}

function readFileCopyClipboard(): FileCopyClipboard | null {
  try {
    const raw = localStorage.getItem(FILE_COPY_CLIPBOARD_STORAGE_KEY)
    if (!raw) return null
    const clipboard = JSON.parse(raw) as FileCopyClipboard
    if (
      !clipboard?.workspaceId ||
      !Array.isArray(clipboard.items) ||
      clipboard.items.length === 0 ||
      clipboard.items.some((item) => !item?.id)
    ) {
      return null
    }
    return clipboard
  } catch {
    return null
  }
}

function writeFileCopyClipboard(clipboard: FileCopyClipboard) {
  try {
    localStorage.setItem(
      FILE_COPY_CLIPBOARD_STORAGE_KEY,
      JSON.stringify(clipboard)
    )
  } catch {
    // 本地存储不可用时，当前页面内的复制粘贴仍然可用。
  }
}

function isHandledError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'handled' in error &&
    error.handled === true
  )
}

function isFolderDownloadTaskActive(task: FolderDownloadTaskVO) {
  return (
    task.status === 'queued' ||
    task.status === 'scanning' ||
    task.status === 'packing'
  )
}

function readStoredFolderDownloadTasks(): FolderDownloadPanelTask[] {
  try {
    const raw = localStorage.getItem(FOLDER_DOWNLOAD_STORAGE_KEY)
    if (!raw) return []
    const tasks = JSON.parse(raw)
    if (!Array.isArray(tasks)) return []
    return tasks.filter(isFolderDownloadTaskActive).slice(0, 5)
  } catch {
    return []
  }
}

function writeStoredFolderDownloadTasks(tasks: FolderDownloadPanelTask[]) {
  try {
    const activeTasks = tasks.filter(isFolderDownloadTaskActive).slice(0, 5)
    if (activeTasks.length === 0) {
      localStorage.removeItem(FOLDER_DOWNLOAD_STORAGE_KEY)
      return
    }
    localStorage.setItem(
      FOLDER_DOWNLOAD_STORAGE_KEY,
      JSON.stringify(activeTasks)
    )
  } catch {
    // 本地存储不可用时不影响下载流程。
  }
}

function getFolderZipFileName(folderName: string) {
  return folderName.toLowerCase().endsWith('.zip')
    ? folderName
    : `${folderName}.zip`
}

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function useFileOperations(
  refreshCallback: () => void,
  clearSelectionCallback?: () => void,
  onCreateFolderSuccess?: () => void,
  updateFileItemsCallback?: (ids: string[], patch: Partial<FileItem>) => void
) {
  const { t } = useTranslation(['files', 'share'])
  const { t: tErrors } = useTranslation('errors')
  const currentWorkspaceId = useWorkspaceStore(
    (state) => state.currentWorkspaceId
  )
  // 模态框状态
  const [createFolderModalVisible, setCreateFolderModalVisible] =
    useState(false)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [fileCopyClipboard, setFileCopyClipboard] =
    useState<FileCopyClipboard | null>(() => readFileCopyClipboard())
  const [pasting, setPasting] = useState(false)

  // 操作的文件
  const [renamingFile, setRenamingFile] = useState<FileItem | null>(null)
  const [movingFile, setMovingFile] = useState<FileItem | null>(null)
  const [movingFiles, setMovingFiles] = useState<FileItem[]>([])
  const [sharingFile, setSharingFile] = useState<FileItem | null>(null)
  const [sharingFiles, setSharingFiles] = useState<FileItem[]>([])
  const [deletingFiles, setDeletingFiles] = useState<FileItem[]>([])
  const [detailFile, setDetailFile] = useState<FileItem | null>(null)
  const [folderDownloadTasks, setFolderDownloadTasks] = useState<
    FolderDownloadPanelTask[]
  >(() => readStoredFolderDownloadTasks())
  const startedFolderDownloadTaskIds = useRef<Set<string>>(new Set())
  const failedFolderDownloadTaskIds = useRef<Set<string>>(new Set())
  const restoredFolderDownloadTaskIds = useRef<Set<string>>(new Set())
  const folderDownloadQueue = useRef(Promise.resolve())

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FILE_COPY_CLIPBOARD_STORAGE_KEY) {
        setFileCopyClipboard(readFileCopyClipboard())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  /**
   * 将文件加入应用内复制剪贴板。剪贴板按工作空间隔离，可重复粘贴。
   */
  const copyToClipboard = useCallback(
    (files: FileItem | FileItem[]) => {
      const fileArray = (Array.isArray(files) ? files : [files]).filter(
        (file, index, all) =>
          all.findIndex((candidate) => candidate.id === file.id) === index
      )
      if (!currentWorkspaceId || fileArray.length === 0) return

      const clipboard: FileCopyClipboard = {
        workspaceId: currentWorkspaceId,
        items: fileArray.map(({ id, displayName, isDir }) => ({
          id,
          displayName,
          isDir,
        })),
        copiedAt: Date.now(),
      }
      setFileCopyClipboard(clipboard)
      writeFileCopyClipboard(clipboard)
      toast.success(
        fileArray.length === 1
          ? t('operations.copyOne', { name: fileArray[0].displayName })
          : t('operations.copyMany', { count: fileArray.length })
      )
    },
    [currentWorkspaceId, t]
  )

  /**
   * 将剪贴板内容复制到目标目录。
   */
  const handlePaste = useCallback(
    async (targetDirId?: string) => {
      if (!fileCopyClipboard || fileCopyClipboard.items.length === 0) {
        toast.warning(t('operations.clipboardEmpty'))
        return
      }
      if (
        !currentWorkspaceId ||
        fileCopyClipboard.workspaceId !== currentWorkspaceId
      ) {
        toast.warning(t('operations.clipboardWorkspaceMismatch'))
        return
      }
      if (pasting) return

      setPasting(true)
      try {
        await copyFiles({
          dirId: targetDirId,
          fileIds: fileCopyClipboard.items.map((item) => item.id),
        })
        toast.success(
          t('operations.pasteOk', { count: fileCopyClipboard.items.length })
        )
        clearSelectionCallback?.()
        refreshCallback()
      } catch (error: unknown) {
        if (!isHandledError(error)) toast.error(t('operations.pasteFail'))
      } finally {
        setPasting(false)
      }
    },
    [
      clearSelectionCallback,
      currentWorkspaceId,
      fileCopyClipboard,
      pasting,
      refreshCallback,
      t,
    ]
  )

  /**
   * 打开创建文件夹弹窗
   */
  const openCreateFolderModal = useCallback(() => {
    setCreateFolderModalVisible(true)
  }, [])

  /**
   * 创建文件夹
   */
  const handleCreateFolder = useCallback(
    async (folderName: string, parentId?: string) => {
      try {
        await createFolder({ folderName: folderName.trim(), parentId })
        toast.success(t('operations.mkdirOk'))
        setCreateFolderModalVisible(false)
        onCreateFolderSuccess?.()
        refreshCallback()
      } catch (error) {
        toast.error(t('operations.mkdirFail'))
      }
    },
    [refreshCallback, onCreateFolderSuccess, t]
  )

  /**
   * 打开重命名弹窗
   */
  const openRenameModal = useCallback((file: FileItem) => {
    setRenamingFile(file)
    setRenameModalVisible(true)
  }, [])

  /**
   * 重命名文件
   */
  const handleRename = useCallback(
    async (fileId: string, newName: string) => {
      try {
        await renameFile(fileId, newName.trim())
        toast.success(t('operations.renameOk'))
        setRenameModalVisible(false)
        setRenamingFile(null)
        clearSelectionCallback?.()
        refreshCallback()
      } catch (error) {
        toast.error(t('operations.renameFail'))
      }
    },
    [refreshCallback, clearSelectionCallback, t]
  )

  /**
   * 打开移动文件弹窗
   */
  const openMoveModal = useCallback((file: FileItem) => {
    setMovingFile(file)
    setMovingFiles([file])
    setMoveModalVisible(true)
  }, [])

  /**
   * 打开批量移动弹窗
   */
  const openBatchMoveModal = useCallback((files: FileItem[]) => {
    setMovingFile(null)
    setMovingFiles(files)
    setMoveModalVisible(true)
  }, [])

  /**
   * 移动文件
   */
  const handleMove = useCallback(
    async (fileIds: string[], targetDirId: string) => {
      try {
        await moveFiles(targetDirId, fileIds)
        toast.success(t('operations.moveOk'))
        setMoveModalVisible(false)
        setMovingFile(null)
        setMovingFiles([])
        clearSelectionCallback?.()
        refreshCallback()
      } catch (error) {
        if (!isHandledError(error)) {
          toast.error(t('operations.moveFail'))
        }
      }
    },
    [refreshCallback, clearSelectionCallback, t]
  )

  /**
   * 打开分享弹窗
   */
  const openShareModal = useCallback((file: FileItem) => {
    setSharingFile(file)
    setSharingFiles([file])
    setShareModalVisible(true)
  }, [])

  /**
   * 打开批量分享弹窗
   */
  const openBatchShareModal = useCallback((files: FileItem[]) => {
    setSharingFile(null)
    setSharingFiles(files)
    setShareModalVisible(true)
  }, [])

  /**
   * 删除文件
   */
  const handleDelete = useCallback(async () => {
    const fileIds = deletingFiles.map((f) => f.id)
    try {
      await deleteFiles(fileIds)
      const successMsg =
        fileIds.length === 1
          ? t('operations.trashOne')
          : t('operations.trashMany', { count: fileIds.length })
      toast.success(successMsg)
      setDeleteDialogVisible(false)
      setDeletingFiles([])
      clearSelectionCallback?.()
      refreshCallback()
    } catch (error) {
      if (!isHandledError(error)) {
        toast.error(t('operations.trashFail'))
      }
    }
  }, [deletingFiles, refreshCallback, clearSelectionCallback, t])

  /**
   * 打开删除确认对话框
   */
  const openDeleteConfirm = useCallback((file: FileItem) => {
    if (file.systemProtected) {
      toast.error(tErrors('file.system.folder.protected'))
      return
    }
    setDeletingFiles([file])
    setDeleteDialogVisible(true)
  }, [tErrors])

  /**
   * 打开批量删除确认对话框
   */
  const openBatchDeleteConfirm = useCallback((files: FileItem[]) => {
    if (files.some((file) => file.systemProtected)) {
      toast.error(tErrors('file.system.folder.protected'))
      return
    }
    setDeletingFiles(files)
    setDeleteDialogVisible(true)
  }, [tErrors])

  const upsertFolderDownloadTask = useCallback(
    (task: FolderDownloadTaskVO, patch?: Partial<FolderDownloadPanelTask>) => {
      setFolderDownloadTasks((prev) => {
        const existing = prev.find((item) => item.taskId === task.taskId)
        const nextTask = {
          ...existing,
          ...task,
          ...patch,
        } as FolderDownloadPanelTask

        if (!existing) {
          return [nextTask, ...prev].slice(0, 5)
        }

        return prev.map((item) =>
          item.taskId === task.taskId ? nextTask : item
        )
      })
    },
    []
  )

  const buildDownloadParams = useCallback(() => {
    const workspaceId = getCurrentWorkspaceId()
    const params = new URLSearchParams()
    if (workspaceId) {
      params.set('X-Workspace-Id', workspaceId)
    }
    return params
  }, [])

  const buildFolderTaskDownloadUrl = useCallback(
    (taskId: string) => {
      const params = buildDownloadParams()
      return `${import.meta.env.VITE_API_BASE_URL}/apis/transfer/folder-download/tasks/${taskId}/file?${params.toString()}`
    },
    [buildDownloadParams]
  )

  const triggerFolderTaskDownload = useCallback((task: FolderDownloadTaskVO) => {
    const download = async () => {
      triggerBrowserDownload(
        buildFolderTaskDownloadUrl(task.taskId),
        getFolderZipFileName(task.folderName)
      )
      await wait(FOLDER_DOWNLOAD_START_GAP_MS)
    }

    const queuedDownload = folderDownloadQueue.current.then(download, download)
    folderDownloadQueue.current = queuedDownload.catch(() => undefined)
    return queuedDownload
  }, [buildFolderTaskDownloadUrl])

  const handleFolderDownloadTaskUpdate = useCallback(
    (task: FolderDownloadTaskVO) => {
      if (
        task.status === 'completed' &&
        !startedFolderDownloadTaskIds.current.has(task.taskId)
      ) {
        startedFolderDownloadTaskIds.current.add(task.taskId)
        upsertFolderDownloadTask(task, { downloadStarted: true })
        void triggerFolderTaskDownload(task)
          .then(() => {
            toast.success(
              t('share:toast.folderDownloadStart', {
                name: getFolderZipFileName(task.folderName),
              })
            )
          })
          .catch(() => {
            toast.error(
              t('share:toast.folderZipDownloadFail', {
                name: getFolderZipFileName(task.folderName),
              })
            )
          })
        return
      }

      if (
        task.status === 'failed' &&
        !failedFolderDownloadTaskIds.current.has(task.taskId)
      ) {
        failedFolderDownloadTaskIds.current.add(task.taskId)
        toast.error(task.errorMessage || t('share:toast.folderPackFail'))
      }

      upsertFolderDownloadTask(task)
    },
    [triggerFolderTaskDownload, upsertFolderDownloadTask]
  )

  const startFolderDownload = useCallback(
    async (folder: FileItem) => {
      try {
        const task = await createFolderDownloadTask(folder.id)
        upsertFolderDownloadTask(task)
        handleFolderDownloadTaskUpdate(task)
        if (isFolderDownloadTaskActive(task)) {
          toast.info(
            t('share:toast.folderPreparing', { name: folder.displayName })
          )
        }
      } catch (error) {
        toast.error(t('share:toast.folderTaskFail'))
      }
    },
    [handleFolderDownloadTaskUpdate, upsertFolderDownloadTask]
  )

  const dismissFolderDownloadTask = useCallback((taskId: string) => {
    setFolderDownloadTasks((prev) =>
      prev.filter((task) => task.taskId !== taskId)
    )
    startedFolderDownloadTaskIds.current.delete(taskId)
    failedFolderDownloadTaskIds.current.delete(taskId)
    restoredFolderDownloadTaskIds.current.delete(taskId)
  }, [])

  const cancelFolderDownloadTask = useCallback(
    async (taskId: string) => {
      try {
        await requestCancelFolderDownloadTask(taskId)
        dismissFolderDownloadTask(taskId)
        toast.info(t('share:toast.folderPackCanceled'))
      } catch (error) {
        if (!isHandledError(error)) {
          toast.error(t('share:toast.folderCancelFail'))
        }
      }
    },
    [dismissFolderDownloadTask]
  )

  useEffect(() => {
    writeStoredFolderDownloadTasks(folderDownloadTasks)
  }, [folderDownloadTasks])

  useEffect(() => {
    const restoredTasks = folderDownloadTasks.filter(
      (task) =>
        isFolderDownloadTaskActive(task) &&
        !restoredFolderDownloadTaskIds.current.has(task.taskId)
    )
    if (restoredTasks.length === 0) return

    restoredTasks.forEach((task) => {
      restoredFolderDownloadTaskIds.current.add(task.taskId)
      getFolderDownloadTask(task.taskId)
        .then(handleFolderDownloadTaskUpdate)
        .catch(() => {
          setFolderDownloadTasks((prev) =>
            prev.filter((item) => item.taskId !== task.taskId)
          )
        })
    })
  }, [folderDownloadTasks, handleFolderDownloadTaskUpdate])

  useEffect(() => {
    const activeTasks = folderDownloadTasks.filter(isFolderDownloadTaskActive)
    if (activeTasks.length === 0) return

    const timer = window.setInterval(() => {
      activeTasks.forEach((task) => {
        getFolderDownloadTask(task.taskId)
          .then(handleFolderDownloadTaskUpdate)
          .catch(() => {
            // 后台轮询失败时保持当前进度，不打扰用户。
          })
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [folderDownloadTasks, handleFolderDownloadTaskUpdate])

  /**
   * 下载文件
   */
  const handleDownload = useCallback((files: FileItem | FileItem[]) => {
    const fileArray = Array.isArray(files) ? files : [files]
    const normalFiles = fileArray.filter((file) => !file.isDir)
    const folders = fileArray.filter((file) => file.isDir)

    normalFiles.forEach((file, index) => {
      setTimeout(() => {
        void getFileAccessUrl(file.id, 3600, true)
          .then(async (url) => {
            if (await probeDirectUrl(url)) {
              triggerBrowserDownload(url, file.displayName)
            } else {
              const blob = await getFileContent(file.id)
              const objectUrl = URL.createObjectURL(blob)
              triggerBrowserDownload(objectUrl, file.displayName)
              URL.revokeObjectURL(objectUrl)
            }
            toast.success(
              normalFiles.length === 1
                ? t('operations.downloadOne')
                : t('operations.downloadMany', { count: normalFiles.length })
            )
          })
          .catch(() => toast.error(t('operations.downloadFail')))
      }, index * 200)
    })

    folders.forEach((folder, index) => {
      setTimeout(() => {
        void startFolderDownload(folder)
      }, index * 200)
    })
  }, [startFolderDownload, t])

  /**
   * 收藏/取消收藏
   * 使用乐观更新：直接修改本地状态，失败时回滚刷新列表
   */
  const handleFavorite = useCallback(
    async (files: FileItem | FileItem[]) => {
      const fileArray = Array.isArray(files) ? files : [files]
      const fileIds = fileArray.map((f) => f.id)

      // 判断是收藏还是取消收藏（如果有任何一个未收藏，就执行收藏操作）
      const hasUnfavorited = fileArray.some((f) => !f.isFavorite)
      const newFavoriteState = hasUnfavorited

      // 乐观更新本地状态
      updateFileItemsCallback?.(fileIds, { isFavorite: newFavoriteState })
      clearSelectionCallback?.()

      try {
        if (hasUnfavorited) {
          await favoriteFile(fileIds)
          toast.success(t('operations.favOk'))
        } else {
          await unfavoriteFile(fileIds)
          toast.success(t('operations.unfavOk'))
        }
      } catch (error) {
        toast.error(hasUnfavorited ? t('operations.favFail') : t('operations.unfavFail'))
      }
    },
    [refreshCallback, clearSelectionCallback, t]
  )

  /**
   * 预览文件
   */
  const openPreview = useCallback(
    async (file: FileItem, navigationFiles: FileItem[] = [], origin?: DOMRect | null) => {
      openFilePreview(file, {
        navigationFiles,
        origin: origin ?? fileTileOrigin(file.id) ?? null,
      })
    },
    []
  )

  /**
   * 打开详细信息弹窗
   */
  const openDetail = useCallback((file: FileItem) => {
    setDetailFile(file)
    setDetailModalVisible(true)
  }, [])

  return {
    // 模态框状态
    createFolderModalVisible,
    setCreateFolderModalVisible,
    renameModalVisible,
    setRenameModalVisible,
    moveModalVisible,
    setMoveModalVisible,
    shareModalVisible,
    setShareModalVisible,
    deleteDialogVisible,
    setDeleteDialogVisible,
    detailModalVisible,
    setDetailModalVisible,

    // 操作的文件
    renamingFile,
    movingFile,
    movingFiles,
    sharingFile,
    sharingFiles,
    deletingFiles,
    detailFile,
    folderDownloadTasks,
    clipboardItemCount:
      fileCopyClipboard?.workspaceId === currentWorkspaceId
        ? fileCopyClipboard.items.length
        : 0,
    pasting,

    // 操作方法
    openCreateFolderModal,
    handleCreateFolder,
    openRenameModal,
    handleRename,
    openMoveModal,
    openBatchMoveModal,
    handleMove,
    openShareModal,
    openBatchShareModal,
    openDeleteConfirm,
    openBatchDeleteConfirm,
    handleDelete,
    handleDownload,
    handleFavorite,
    copyToClipboard,
    handlePaste,
    openPreview,
    openDetail,
    dismissFolderDownloadTask,
    cancelFolderDownloadTask,
  }
}
