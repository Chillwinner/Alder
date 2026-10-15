/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { FileItem, SortOrder } from '@/types/file'
import { Download, FolderInput, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatFileSize, formatFileTime } from '@/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileIcon } from '@/components/file-icon'

interface ShareFileListViewProps {
  fileList: FileItem[]
  onFileClick: (file: FileItem) => void
  onDownload: (file: FileItem) => void
  onSaveToWorkspace?: (file: FileItem) => void
  orderBy: string
  orderDirection: SortOrder
  onSortChange: (field: string, direction: SortOrder) => void
}

/** 下载是这一页的主操作：实心系统蓝；保存为次级蓝色胶囊。 */
const rowActionClass = 'a-btn'
const rowActionStyle = { height: 40, padding: '0 13px' } as const

export function ShareFileListView({
  fileList,
  onFileClick,
  onDownload,
  onSaveToWorkspace,
  orderBy,
  orderDirection,
  onSortChange,
}: ShareFileListViewProps) {
  const { t } = useTranslation('share')
  const handleDoubleClick = (file: FileItem) => {
    if (file.isDir) {
      onFileClick(file)
    }
  }

  const handleHeaderSort = (field: string) => {
    const nextDirection: SortOrder =
      orderBy === field
        ? orderDirection === 'ASC'
          ? 'DESC'
          : 'ASC'
        : field === 'displayName' || field === 'suffix'
          ? 'ASC'
          : 'DESC'
    onSortChange(field, nextDirection)
  }

  const renderSortIcon = (field: string) => {
    if (orderBy !== field) {
      return <ChevronsUpDown className='size-3.5 opacity-50' />
    }
    return orderDirection === 'ASC' ? (
      <ArrowUp className='size-3.5' />
    ) : (
      <ArrowDown className='size-3.5' />
    )
  }

  const sortButton = (field: string, label: string) => (
    <button
      type='button'
      className='inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-text-muted uppercase transition-colors hover:text-foreground'
      onClick={() => handleHeaderSort(field)}
    >
      {label}
      {renderSortIcon(field)}
    </button>
  )

  return (
    <div className='min-w-0 flex-1 overflow-auto'>
      <div className='overflow-hidden rounded-[18px] border border-divider bg-surface/40'>
        <Table>
          <TableHeader className='[&_tr]:border-b [&_tr]:border-divider'>
            <TableRow className='border-divider hover:bg-transparent'>
              <TableHead className='h-[44px] px-4 text-left'>
                {sortButton('displayName', t('fileList.name'))}
              </TableHead>
              <TableHead className='h-[44px] w-28 px-4 text-left'>
                {sortButton('suffix', t('fileList.type'))}
              </TableHead>
              <TableHead className='h-[44px] w-28 px-4 text-left'>
                {sortButton('size', t('fileList.size'))}
              </TableHead>
              <TableHead className='h-[44px] w-44 px-4 text-left'>
                {sortButton('updateTime', t('fileList.modified'))}
              </TableHead>
              <TableHead className='h-[44px] w-32 px-4 text-right font-mono text-[11px] tracking-wider text-text-muted uppercase'>
                {t('fileList.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fileList.map((file) => (
              <TableRow
                key={file.id}
                className={cn(
                  'group border-divider transition-colors hover:bg-surface-hover',
                  file.isDir && 'cursor-pointer'
                )}
                onDoubleClick={() => {
                  if (file.unavailable) return
                  handleDoubleClick(file)
                }}
              >
                <TableCell className='px-4 py-2.5'>
                  <div className='flex items-center gap-3'>
                    <span className='flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary'>
                      <FileIcon
                        type={file.unavailable ? 'invalid' : file.isDir ? 'dir' : file.suffix || ''}
                        size={26}
                        className='shrink-0'
                      />
                    </span>
                    <div className='min-w-0'>
                      <span className='block truncate text-[13.5px] font-medium text-foreground'>
                        {file.displayName || t('fileList.unavailable')}
                      </span>
                      {file.unavailable ? (
                        <span className='mt-0.5 block text-[11.5px] text-text-muted'>
                          {t('fileList.unavailable')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className='px-4 font-mono text-[11.5px] tracking-wider text-text-muted uppercase'>
                  {file.unavailable
                    ? '—'
                    : file.isDir
                    ? t('fileList.folderType')
                    : file.suffix?.toUpperCase() || t('fileList.unknownType')}
                </TableCell>
                <TableCell className='px-4 font-mono text-[12px] tabular-nums text-text-secondary'>
                  {file.isDir ? '-' : formatFileSize(file.size)}
                </TableCell>
                <TableCell className='px-4 font-mono text-[12px] tabular-nums text-text-secondary'>
                  {formatFileTime(file.updateTime)}
                </TableCell>
                <TableCell className='px-4 text-right' onClick={(e) => e.stopPropagation()}>
                  {file.unavailable ? null : (
                    <div className='flex items-center justify-end gap-1.5'>
                      {onSaveToWorkspace ? (
                        <button
                          type='button'
                          className={cn(rowActionClass, 'a-btn--secondary')}
                          style={rowActionStyle}
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
                        className={cn(rowActionClass, 'a-btn--primary')}
                        style={rowActionStyle}
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
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
