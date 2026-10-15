/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ImageIcon, X } from 'lucide-react'
import { FileIcon } from '@/components/file-icon'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  fileNameToIconType,
  formatImMediaSize,
  IM_MSG_FILE,
  IM_MSG_IMAGE,
} from '@/utils/im-message-content'
import { resolveMediaUrl } from '@/utils/media-url'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'

export type ImPendingUpload = {
  id: string
  file: File
  msgType: typeof IM_MSG_IMAGE | typeof IM_MSG_FILE
  progress: number
  phase: 'uploading' | 'sending' | 'failed'
  error?: string
  abort: () => void
  workspaceFileId?: string
  byteSize?: number
  isDir?: boolean
}

type ImPendingUploadRowProps = {
  upload: ImPendingUpload
  selfName: string
  selfAvatar?: string | null
  onRetry?: (upload: ImPendingUpload) => void
  onDismiss?: (upload: ImPendingUpload) => void
}

export function ImPendingUploadRow({
  upload,
  selfName,
  selfAvatar,
  onRetry,
  onDismiss,
}: ImPendingUploadRowProps) {
  const { t } = useTranslation('messages')
  const colors = getAvatarColorPair(selfName)
  const isImage = upload.msgType === IM_MSG_IMAGE
  const label =
    upload.phase === 'sending'
      ? t('room.sending')
      : upload.phase === 'failed'
        ? upload.error || t('room.uploadFailed')
        : t('room.uploading')

  return (
    <div className='grid w-full min-w-0 grid-cols-[minmax(0,1fr)_1.875rem] items-end gap-1.5 pt-2'>
      <div className='flex min-w-0 flex-col items-end gap-1.5 overflow-hidden'>
        <div className='im-pending'>
          <div className='flex items-start gap-2.5'>
            <span className='im-file__icon'>
              {isImage ? (
                <ImageIcon className='size-4' />
              ) : (
                <FileIcon
                  type={fileNameToIconType(upload.file.name, upload.isDir)}
                  size={20}
                />
              )}
            </span>
            <span className='min-w-0 flex-1'>
              <span className='im-file__name'>{upload.file.name}</span>
              <span className='im-file__meta'>
                {formatImMediaSize(
                  {
                    size: upload.byteSize ?? upload.file.size,
                    isDir: upload.isDir,
                  },
                  t('room.file')
                )}
              </span>
              {upload.workspaceFileId ? (
                <span className='im-file__hint'>{t('room.sharedFromWorkspace')}</span>
              ) : null}
            </span>
            {upload.phase !== 'failed' && (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='im-iconbtn size-7'
                aria-label={t('room.cancelUpload')}
                onClick={() => upload.abort()}
              >
                <X className='size-3.5' />
              </Button>
            )}
          </div>
          {upload.phase !== 'failed' && (
            <div className='flex flex-col mt-2 gap-1'>
              <Progress value={upload.progress} className='h-1.5' />
              <span className='block text-[11px] text-muted-foreground'>{label}</span>
            </div>
          )}
          {upload.phase === 'failed' && (
            <div className='mt-2 flex items-center justify-between gap-2'>
              <span className='min-w-0 truncate text-[11px] text-destructive'>{label}</span>
              <div className='flex shrink-0 gap-1'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-6 px-2 text-[11px]'
                  onClick={() => onRetry?.(upload)}
                >
                  {t('room.retryUpload')}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='im-iconbtn size-6'
                  aria-label={t('room.dismissUpload')}
                  onClick={() => onDismiss?.(upload)}
                >
                  <X className='size-3.5' />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Avatar className='im-msg-avatar'>
        {selfAvatar ? (
          <AvatarImage src={resolveMediaUrl(selfAvatar)} alt={selfName} className='im-msg-avatar__img' />
        ) : null}
        <AvatarFallback
          className='im-msg-avatar__img text-[11px] font-semibold'
          style={{ backgroundColor: colors.background, color: colors.color }}
        >
          {getDisplayInitials(selfName)}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

export function isImUploadAbortError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false
  const err = cause as { code?: string; name?: string; message?: string }
  return err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.message === 'canceled'
}
