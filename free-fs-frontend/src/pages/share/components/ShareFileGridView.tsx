/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { FileItem } from '@/types/file'
import { Download, FolderInput, MoreVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatFileTime } from '@/utils/format'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import { FileIcon } from '@/components/file-icon'

interface ShareFileGridViewProps {
  fileList: FileItem[]
  onFileClick: (file: FileItem) => void
  onDownload: (file: FileItem) => void
  onSaveToWorkspace?: (file: FileItem) => void
}

export function ShareFileGridView({
  fileList,
  onFileClick,
  onDownload,
  onSaveToWorkspace,
}: ShareFileGridViewProps) {
  const { t } = useTranslation('share')

  const handleDoubleClick = (file: FileItem) => {
    if (file.isDir) {
      onFileClick(file)
    }
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-3.5'>
      {fileList.map((file) => (
        <div
          key={file.id}
          data-tilt=''
          className={cn(
            'group relative flex flex-col rounded-[20px] border border-divider bg-surface/40 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-hover',
            file.isDir && 'cursor-pointer'
          )}
          onDoubleClick={() => {
            if (file.unavailable) return
            handleDoubleClick(file)
          }}
        >
          {/* 更多操作 */}
          {file.unavailable ? null : (
            <div className='absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100'>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-7'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
<DropdownMenuGroup>
                  {onSaveToWorkspace ? (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onSaveToWorkspace(file)
                      }}
                    >
                      <FolderInput className='mr-2 h-4 w-4' />
                      {t('fileList.save')}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload(file)
                    }}
                  >
                    <Download className='mr-2 h-4 w-4' />
                    {t('fileList.download')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
</DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* 文件图标 */}
          <div className='mb-3 flex h-[62px] items-center justify-center'>
            <FileIcon
              type={file.unavailable ? 'invalid' : file.isDir ? 'dir' : file.suffix || ''}
              size={48}
              className='transition-transform group-hover:scale-105'
            />
          </div>

          {/* 文件名 */}
          <div className='truncate text-[13px] leading-snug font-medium text-foreground'>
            {file.displayName || (file.unavailable ? t('fileList.unavailable') : '')}
          </div>

          {/* 修改时间 */}
          <div className='mt-1 font-mono text-[11.5px] tabular-nums text-text-muted'>
            {file.unavailable ? t('fileList.unavailable') : formatFileTime(file.updateTime)}
          </div>

          {/* 主操作：下载（系统蓝） */}
          <div className='mt-3 flex items-center gap-2'>
            {onSaveToWorkspace ? (
              <button
                type='button'
                className='a-btn a-btn--secondary'
                style={{ height: 40, padding: '0 12px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onSaveToWorkspace(file)
                }}
                title={t('fileList.save')}
                aria-label={t('fileList.save')}
              >
                <FolderInput className='size-4' strokeWidth={1.9} />
              </button>
            ) : null}
            <button
              type='button'
              className='a-btn a-btn--primary a-btn--block'
              style={{ height: 40 }}
              onClick={(e) => {
                e.stopPropagation()
                onDownload(file)
              }}
              title={t('fileList.download')}
              aria-label={t('fileList.download')}
            >
              <Download className='size-4' strokeWidth={1.9} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
