/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { AlertCircle, CheckCircle2, FileArchive, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { formatFileSize } from '@/utils/format'
import type { FolderDownloadTaskVO } from '@/types/transfer'

export type FolderDownloadPanelTask = FolderDownloadTaskVO & {
  downloadStarted?: boolean
}

interface FolderDownloadPanelProps {
  tasks: FolderDownloadPanelTask[]
  onDismiss: (taskId: string) => void
  onCancel: (taskId: string) => void
}

function isActive(status: FolderDownloadTaskVO['status']) {
  return status === 'queued' || status === 'scanning' || status === 'packing'
}

export default function FolderDownloadPanel({
  tasks,
  onDismiss,
  onCancel,
}: FolderDownloadPanelProps) {
  const { t } = useTranslation('files')

  const getStatusText = (task: FolderDownloadPanelTask) => {
    if (task.status === 'failed') {
      return task.errorMessage || t('folderDownloadPanel.statusFailed')
    }
    if (task.status === 'canceled') return t('folderDownloadPanel.statusCanceled')
    if (task.status === 'expired') return t('folderDownloadPanel.statusExpired')
    if (task.status === 'downloading') return t('folderDownloadPanel.statusDownloading')
    if (task.status === 'completed') {
      return task.downloadStarted
        ? t('folderDownloadPanel.statusBrowserDownload')
        : t('folderDownloadPanel.statusReady')
    }
    return task.message || t('folderDownloadPanel.statusPreparing')
  }

  if (tasks.length === 0) return null

  return (
    <div className='fixed right-10 bottom-24 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2'>
      {tasks.map((task) => {
        const progress = Math.max(0, Math.min(100, task.progress || 0))
        const active = isActive(task.status)
        return (
          <div
            key={task.taskId}
            className='glass-card overflow-hidden p-3'
          >
            <div className='flex items-start gap-3'>
              <div className='mt-0.5 shrink-0'>
                {active ? (
                  <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                ) : task.status === 'completed' ||
                  task.status === 'downloading' ? (
                  <CheckCircle2 className='h-5 w-5 text-success' />
                ) : (
                  <AlertCircle className='h-5 w-5 text-destructive' />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-start gap-2'>
                  <FileArchive className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium text-foreground'>
                      {task.folderName}
                    </div>
                    <div className='mt-0.5 text-xs text-muted-foreground'>
                      {getStatusText(task)}
                    </div>
                  </div>
                  <X
                    className='h-4 w-4 shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground'
                    title={
                      active
                        ? t('folderDownloadPanel.cancelPack')
                        : t('folderDownloadPanel.close')
                    }
                    onClick={() =>
                      active ? onCancel(task.taskId) : onDismiss(task.taskId)
                    }
                  />
                </div>

                <div className='flex flex-col mt-3 gap-1.5'>
                  <Progress value={progress} className='h-1.5' />
                  <div className='flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums text-muted-foreground'>
                    <span className='text-hud'>{progress}%</span>
                    <span>
                      {t('folderDownloadPanel.filesProgress', {
                        done: task.processedFiles || 0,
                        total: task.totalFiles || 0,
                      })}
                    </span>
                  </div>
                  {task.totalBytes > 0 && (
                    <div className='font-mono text-xs tabular-nums text-muted-foreground'>
                      {formatFileSize(task.processedBytes || 0)} /{' '}
                      {formatFileSize(task.totalBytes)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
