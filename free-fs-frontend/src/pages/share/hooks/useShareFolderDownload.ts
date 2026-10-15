/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWorkspaceId } from '@/store/workspace'
import type { FileItem } from '@/types/file'
import type { FolderDownloadTaskVO } from '@/types/transfer'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  cancelShareFolderDownloadTask,
  createShareFolderDownloadTask,
  getShareFolderDownloadTask,
} from '@/api/share'

export type ShareFolderDownloadTask = FolderDownloadTaskVO & {
  downloadStarted?: boolean
}

function isTaskActive(task: FolderDownloadTaskVO) {
  return (
    task.status === 'queued' ||
    task.status === 'scanning' ||
    task.status === 'packing'
  )
}

function getZipFileName(folderName: string) {
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

export function useShareFolderDownload(shareId?: string) {
  const { t } = useTranslation('share')
  const [tasks, setTasks] = useState<ShareFolderDownloadTask[]>([])
  const startedTaskIds = useRef(new Set<string>())
  const failedTaskIds = useRef(new Set<string>())

  const upsertTask = useCallback(
    (task: FolderDownloadTaskVO, patch?: Partial<ShareFolderDownloadTask>) => {
      setTasks((current) => {
        const existing = current.find((item) => item.taskId === task.taskId)
        const nextTask = {
          ...existing,
          ...task,
          ...patch,
        } as ShareFolderDownloadTask

        if (!existing) return [nextTask, ...current].slice(0, 5)
        return current.map((item) =>
          item.taskId === task.taskId ? nextTask : item
        )
      })
    },
    []
  )

  const startZipDownload = useCallback(
    (task: FolderDownloadTaskVO) => {
      if (!shareId) return
      const params = new URLSearchParams()
      const workspaceId = getCurrentWorkspaceId()
      if (workspaceId) params.set('X-Workspace-Id', workspaceId)
      const url = `${import.meta.env.VITE_API_BASE_URL}/apis/share/${shareId}/folder-download/tasks/${task.taskId}/file?${params.toString()}`
      triggerBrowserDownload(url, getZipFileName(task.folderName))
    },
    [shareId]
  )

  const handleTaskUpdate = useCallback(
    (task: FolderDownloadTaskVO) => {
      if (
        task.status === 'completed' &&
        !startedTaskIds.current.has(task.taskId)
      ) {
        startedTaskIds.current.add(task.taskId)
        upsertTask(task, { downloadStarted: true })
        startZipDownload(task)
        toast.success(
          t('toast.folderDownloadStart', {
            name: getZipFileName(task.folderName),
          })
        )
        return
      }

      if (task.status === 'failed' && !failedTaskIds.current.has(task.taskId)) {
        failedTaskIds.current.add(task.taskId)
        toast.error(task.errorMessage || t('toast.folderPackFail'))
      }

      upsertTask(task)
    },
    [startZipDownload, t, upsertTask]
  )

  const downloadFolder = useCallback(
    async (folder: FileItem) => {
      if (!shareId) return
      try {
        const task = await createShareFolderDownloadTask(shareId, folder.id)
        upsertTask(task)
        handleTaskUpdate(task)
        if (isTaskActive(task)) {
          toast.info(t('toast.folderPreparing', { name: folder.displayName }))
        }
      } catch {
        toast.error(t('toast.folderTaskFail'))
      }
    },
    [handleTaskUpdate, shareId, t, upsertTask]
  )

  const dismissTask = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.taskId !== taskId))
    startedTaskIds.current.delete(taskId)
    failedTaskIds.current.delete(taskId)
  }, [])

  const cancelTask = useCallback(
    async (taskId: string) => {
      if (!shareId) return
      try {
        await cancelShareFolderDownloadTask(shareId, taskId)
        dismissTask(taskId)
        toast.info(t('toast.folderPackCanceled'))
      } catch {
        toast.error(t('toast.folderCancelFail'))
      }
    },
    [dismissTask, shareId]
  )

  useEffect(() => {
    if (!shareId) return
    const activeTasks = tasks.filter(isTaskActive)
    if (activeTasks.length === 0) return

    const timer = window.setInterval(() => {
      activeTasks.forEach((task) => {
        getShareFolderDownloadTask(shareId, task.taskId)
          .then(handleTaskUpdate)
          .catch(() => {
            // 临时轮询失败时保留当前进度，下一轮继续查询。
          })
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [handleTaskUpdate, shareId, tasks])

  return {
    tasks,
    downloadFolder,
    dismissTask,
    cancelTask,
  }
}
