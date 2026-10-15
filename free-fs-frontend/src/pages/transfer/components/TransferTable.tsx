/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask, TaskStatus } from '@/types/transfer'
import { Play, Pause, X, RotateCw } from 'lucide-react'
import { formatDate, formatFileSize } from '@/utils/format'
import { FileIcon } from '@/components/file-icon'
import { cn } from '@/lib/utils'

interface TransferTableProps {
  tasks: TransferTask[]
  loading: boolean
  showActions?: boolean
  showCompleteTime?: boolean
  onPause: (taskId: string) => void
  onResume: (taskId: string) => void
  onCancel: (taskId: string) => void
  onRetry: (taskId: string) => void
}

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

function formatRemainingTime(
  seconds: number,
  tr: (key: string, opt?: Record<string, unknown>) => string
): string {
  if (seconds === 0 || !isFinite(seconds)) return '--'
  if (seconds < 60) return tr('time.sec', { n: Math.round(seconds) })
  if (seconds < 3600)
    return tr('time.min', { n: Math.round(seconds / 60) })
  return tr('time.hour', { n: Math.round(seconds / 3600) })
}

/** 状态 chip 的语气：进行中 = 强调色，完成 = 成功色，失败 = 危险色，其余 = 中性 */
const chipTone = (status: TaskStatus): string => {
  if (status === 'completed') return 'tf-chip--ok'
  if (status === 'failed') return 'tf-chip--err'
  if (
    status === 'checking' ||
    status === 'uploading' ||
    status === 'downloading' ||
    status === 'merging'
  ) {
    return 'tf-chip--run'
  }
  return 'tf-chip--mute'
}

/** 取文件后缀交给统一的文件图标（TransferTask 只带文件名，没有 suffix 字段） */
const suffixOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.')
  return dot > -1 ? fileName.slice(dot + 1) : ''
}

/**
 * 传输任务列表：demo 的行形态 —— 文件图标 + 文件名/状态 chip +
 * mono 元信息 + .a-bar 进度条，右侧是 .a-btn--sm 操作组。
 */
export default function TransferTable({
  tasks,
  showActions = false,
  showCompleteTime = false,
  onPause,
  onResume,
  onCancel,
  onRetry,
}: TransferTableProps) {
  const { t } = useTranslation('transfer')
  const deferredTasks = React.useDeferredValue(tasks)

  const statusMap = React.useMemo(
    () =>
      ({
        idle: t('status.idle'),
        initialized: t('status.initialized'),
        checking: t('status.checking'),
        uploading: t('status.uploading'),
        downloading: t('status.downloading'),
        paused: t('status.paused'),
        merging: t('status.merging'),
        completed: t('status.completed'),
        failed: t('status.failed'),
        cancelled: t('status.cancelled'),
      }) satisfies Record<TaskStatus, string>,
    [t]
  )

  const statusText = (status: TaskStatus) =>
    statusMap[status] ?? t('status.unknown')

  const canPause = (status: TaskStatus) =>
    status === 'uploading' || status === 'downloading'
  const canResume = (status: TaskStatus) => status === 'paused'
  const canRetry = (status: TaskStatus) => status === 'failed'
  const canCancel = (status: TaskStatus) =>
    ['initialized', 'checking', 'uploading', 'downloading', 'paused', 'failed'].includes(
      status
    )

  const renderSpinner = (label: string) => (
    <span className='inline-flex items-center gap-2'>
      <span className='inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
      {label}
    </span>
  )

  const renderMeta = (
    task: TransferTask,
    displayData: { progress: number; speed: number; remainingTime: number }
  ) => {
    switch (task.status) {
      case 'idle':
      case 'initialized':
        return renderSpinner(t('table.prep'))
      case 'checking':
        return renderSpinner(t('table.checking'))
      case 'merging':
        return renderSpinner(t('table.merging'))
      case 'uploading':
      case 'downloading':
        return (
          <>
            <span className='font-medium text-text-primary'>
              {formatFileSize(task.uploadedBytes || 0)}
            </span>
            <span className='text-text-muted'> / </span>
            <span className='text-text-muted'>
              {formatFileSize(task.fileSize)}
            </span>
            <span className='text-text-muted'>
              {' · '}
              {formatSpeed(displayData.speed)}
            </span>
            {displayData.remainingTime > 0 && (
              <span className='text-text-muted'>
                {' · '}
                {t('table.remaining', {
                  time: formatRemainingTime(displayData.remainingTime, t),
                })}
              </span>
            )}
          </>
        )
      case 'paused':
        return (
          <>
            <span className='font-medium text-text-primary'>
              {formatFileSize(task.uploadedBytes || 0)}
            </span>
            <span className='text-text-muted'> / </span>
            <span className='text-text-muted'>
              {formatFileSize(task.fileSize)}
            </span>
            <span className='text-text-muted'>
              {' · '}
              {t('table.paused')}
            </span>
          </>
        )
      case 'completed':
        return <span className='text-text-muted'>{formatFileSize(task.fileSize)}</span>
      case 'failed':
        return (
          <span className='text-destructive'>
            {task.errorMessage || t('table.uploadFailed')}
          </span>
        )
      case 'cancelled':
        return (
          <>
            <span className='text-text-muted'>{formatFileSize(task.fileSize)}</span>
            <span className='text-text-muted'>
              {' · '}
              {t('table.cancelled')}
            </span>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className='flex flex-col gap-2.5'>
      {deferredTasks.map((task, index) => {
        const displayData = {
          progress: task.progress || 0,
          speed: task.speed || 0,
          remainingTime: task.remainingTime || 0,
        }
        const isActive =
          task.status === 'uploading' || task.status === 'downloading'
        const isPaused = task.status === 'paused'
        const isCompleted = task.status === 'completed'
        const progress = Math.min(
          100,
          Math.max(0, Math.round(displayData.progress))
        )
        // 进行中与暂停中都保留进度条；已完成/失败/取消不再画进度
        const showBar = isActive || isPaused

        return (
          <article
            key={task.taskId}
            className='tf-row tf-stagger p-3.5 sm:p-4'
            style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
          >
            <div className='flex items-center gap-3.5'>
              <FileIcon
                type={suffixOf(task.fileName)}
                size={38}
                className='shrink-0'
              />

              {/* 中列：文件名 + 状态 chip / mono 元信息 / 进度条 */}
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 items-center gap-2'>
                  <p
                    className='truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-text-primary'
                    title={task.fileName}
                  >
                    {task.fileName}
                  </p>
                  <span className={cn('tf-chip', chipTone(task.status))}>
                    {statusText(task.status)}
                  </span>
                </div>

                <p className='mt-1.5 truncate font-mono text-[12.5px] leading-relaxed tabular-nums text-text-muted'>
                  {renderMeta(task, displayData)}
                </p>

                {showBar && (
                  <div
                    className={cn('a-bar mt-2.5', isPaused && 'tf-bar--hold')}
                    role='presentation'
                  >
                    <i style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>

              {/* 右列：完成时间 / 行内操作 */}
              <div className='flex shrink-0 items-center justify-end gap-1.5'>
                {showCompleteTime && isCompleted && task.updatedAt && (
                  <span className='font-mono text-[11.5px] tabular-nums text-text-muted'>
                    {formatDate(task.updatedAt, 'YYYY/M/D HH:mm:ss')}
                  </span>
                )}

                {showActions && (
                  <>
                    {canPause(task.status) && (
                      <button
                        type='button'
                        className='a-btn a-btn--sm a-btn--ghost'
                        onClick={() => onPause(task.taskId)}
                      >
                        <Pause className='size-3.5' strokeWidth={2} />
                        {t('table.btnPause')}
                      </button>
                    )}

                    {canResume(task.status) && (
                      <button
                        type='button'
                        className='a-btn a-btn--sm a-btn--ghost'
                        onClick={() => onResume(task.taskId)}
                      >
                        <Play className='size-3.5' strokeWidth={2} />
                        {t('table.btnResume')}
                      </button>
                    )}

                    {canRetry(task.status) && (
                      <button
                        type='button'
                        className='a-btn a-btn--sm a-btn--ghost'
                        onClick={() => onRetry(task.taskId)}
                      >
                        <RotateCw className='size-3.5' strokeWidth={2} />
                        {t('table.btnRetry')}
                      </button>
                    )}

                    {canCancel(task.status) && (
                      <button
                        type='button'
                        className='a-btn a-btn--sm a-btn--plain tf-danger'
                        onClick={() => onCancel(task.taskId)}
                      >
                        <X className='size-3.5' strokeWidth={2} />
                        {t('table.btnCancel')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
