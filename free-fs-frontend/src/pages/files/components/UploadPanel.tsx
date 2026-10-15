/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/store/transfer'
import { X, FileIcon, CheckCircle2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}


interface UploadPanelProps {
  onSuccess?: () => void
}

export default function UploadPanel({ onSuccess }: UploadPanelProps) {
  const { t } = useTranslation(['files', 'transfer'])
  const formatRemainingTime = (seconds: number): string => {
    if (seconds === 0 || !isFinite(seconds)) return '--'
    const n = Math.round(seconds)
    if (seconds < 60) return t('transfer:time.sec', { n })
    if (seconds < 3600) return t('transfer:time.min', { n: Math.round(seconds / 60) })
    return t('transfer:time.hour', { n: Math.round(seconds / 3600) })
  }
  const [showPanel, setShowPanel] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [prevCompletedCount, setPrevCompletedCount] = useState(0)

  const { getCurrentSessionTasks } = useTransferStore()
  const taskList = getCurrentSessionTasks()

  const isUploading = taskList.some((t) =>
    ['initialized', 'checking', 'uploading', 'merging'].includes(t.status)
  )

  const completedCount = taskList.filter((t) => t.status === 'completed').length
  const allCompleted =
    taskList.length > 0 &&
    taskList.every((t) =>
      ['completed', 'failed', 'cancelled'].includes(t.status)
    )

  const summaryText = useMemo(
    () =>
      isUploading
        ? t('files:uploadPanel.uploading', {
            done: completedCount,
            total: taskList.length,
          })
        : t('files:uploadPanel.done', { count: taskList.length }),
    [isUploading, completedCount, taskList.length, t]
  )

  // 显示面板：有任务时显示
  useEffect(() => {
    if (taskList.length > 0) {
      setShowPanel(true)
    }
  }, [taskList.length])

  // 自动关闭：所有任务完成后 3 秒自动关闭
  useEffect(() => {
    if (allCompleted && showPanel) {
      const timer = setTimeout(() => {
        setShowPanel(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [allCompleted, showPanel])

  // 成功回调
  useEffect(() => {
    // 当完成数量增加时，调用 onSuccess 回调
    if (
      completedCount > prevCompletedCount &&
      completedCount > 0 &&
      onSuccess
    ) {
      onSuccess()
    }
    setPrevCompletedCount(completedCount)
  }, [completedCount, prevCompletedCount, onSuccess])

  if (!showPanel) return null

  return (
    <div className='glass-card fixed right-10 bottom-6 z-50 overflow-hidden'>
      {!isExpanded ? (
        <div
          className='flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-hover'
          onClick={() => setIsExpanded(true)}
        >
          {isUploading ? (
            <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          ) : (
            <CheckCircle2 className='h-4 w-4 text-success' />
          )}
          <span className='text-sm font-medium'>{summaryText}</span>
          <X
            className='h-4 w-4 text-muted-foreground transition-colors hover:text-foreground'
            onClick={(e) => {
              e.stopPropagation()
              setShowPanel(false)
            }}
          />
        </div>
      ) : (
        <div className='flex max-h-[400px] w-[360px] flex-col'>
          <div className='flex items-center justify-between border-b border-border px-4 py-3'>
            <span className='text-sm font-medium'>{summaryText}</span>
            <X
              className='h-4 w-4 cursor-pointer text-muted-foreground transition-colors hover:text-foreground'
              onClick={() => setShowPanel(false)}
            />
          </div>

          <div className='flex-1 overflow-y-auto p-2'>
            {taskList.length === 0 ? (
              <div className='py-8 text-center text-[13.5px] text-muted-foreground'>
                {t('files:uploadPanel.empty')}
              </div>
            ) : (
              taskList.map((task) => (
                <div
                  key={task.taskId}
                  className='flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-surface-hover'
                >
                  <FileIcon className='mt-1 h-6 w-6 flex-shrink-0' />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>
                      {task.fileName}
                    </div>

                    {/* Idle/Initialized */}
                    {(task.status === 'idle' ||
                      task.status === 'initialized') && (
                      <div className='mt-1 flex items-center gap-2'>
                        <div className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                        <span className='text-xs text-muted-foreground'>
                          {t('transfer:table.prep')}
                        </span>
                      </div>
                    )}

                    {/* Checking */}
                    {task.status === 'checking' && (
                      <div className='mt-1 flex items-center gap-2'>
                        <div className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                        <span className='text-xs text-muted-foreground'>
                          {t('transfer:table.checking')}
                        </span>
                      </div>
                    )}

                    {/* Uploading */}
                    {task.status === 'uploading' && (
                      <div className='flex flex-col mt-1 gap-1'>
                        <Progress value={task.progress} className='h-1' />
                        <div className='flex items-center justify-between font-mono text-xs tabular-nums'>
                          <span className='font-medium text-hud'>
                            {formatSpeed(task.speed)}
                          </span>
                          {task.remainingTime > 0 && (
                            <span className='text-muted-foreground'>
                              {t('files:uploadPanel.remaining', {
                                time: formatRemainingTime(task.remainingTime),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Paused */}
                    {task.status === 'paused' && (
                      <div className='flex flex-col mt-1 gap-1'>
                        <Progress value={task.progress} className='h-1' />
                        <span className='text-xs text-muted-foreground'>
                          {t('transfer:table.paused')}
                        </span>
                      </div>
                    )}

                    {/* Merging */}
                    {task.status === 'merging' && (
                      <div className='mt-1 flex items-center gap-2'>
                        <div className='h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                        <span className='text-xs text-muted-foreground'>
                          {t('transfer:table.merging')}
                        </span>
                      </div>
                    )}

                    {/* Completed */}
                    {task.status === 'completed' && (
                      <span className='mt-1 block font-mono text-xs text-success'>
                        {t('files:uploadPanel.completedDest')}
                      </span>
                    )}

                    {/* Failed */}
                    {task.status === 'failed' && (
                      <span className='mt-1 block text-xs text-destructive'>
                        {task.errorMessage || t('transfer:table.uploadFailed')}
                      </span>
                    )}

                    {/* Cancelled */}
                    {task.status === 'cancelled' && (
                      <span className='mt-1 block text-xs text-muted-foreground'>
                        {t('transfer:table.cancelled')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            className='cursor-pointer border-t border-border px-4 py-3 text-center text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground'
            onClick={() => setIsExpanded(false)}
          >
            {t('files:uploadPanel.collapse')}
          </div>
        </div>
      )}
    </div>
  )
}
