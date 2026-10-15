/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItem, BreadcrumbItem } from '@/types/file'
import { getFileDetail } from '@/api/file'
import { formatFileSize, formatTime } from '@/utils/format'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FileIcon } from '@/components/file-icon'
import { isLocalMountId } from '@/lib/storage-mount'
import {
  DescriptionField,
  DescriptionFieldLabel,
  DescriptionFieldList,
  DescriptionFieldValue,
} from '@/components/field-layout'

interface FileDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileItem | null
  breadcrumbPath: BreadcrumbItem[]
}

export function FileDetailModal({
  open,
  onOpenChange,
  file,
  breadcrumbPath,
}: FileDetailModalProps) {
  const { t } = useTranslation('files')
  const [loading, setLoading] = useState(false)
  const [detailData, setDetailData] = useState<FileItem | null>(null)

  useEffect(() => {
    if (open && file) {
      loadFileDetail()
    } else {
      setDetailData(null)
    }
  }, [open, file])

  const loadFileDetail = async () => {
    if (!file) return

    setLoading(true)
    try {
      const data = await getFileDetail(file.id)
      setDetailData(data)
    } finally {
      setLoading(false)
    }
  }

  if (!file) return null

  const displayFile = detailData || file

  const formatSizeDisplay = () => {
    if (isLocalMountId(displayFile.id)) return null
    if (displayFile.isDir) {
      return t('fileDetail.sizeWithCounts', {
        size: formatFileSize(displayFile.size || 0),
        files: displayFile.includeFiles ?? 0,
        folders: displayFile.includeFolders ?? 0,
      })
    }
    return formatFileSize(displayFile.size || 0)
  }

  const formatFileLocation = () => {
    if (breadcrumbPath.length === 0) {
      return t('fileDetail.locationRoot')
    }
    return t('fileDetail.locationPath', {
      path: breadcrumbPath.map((item) => item.name).join(' / '),
    })
  }

  const sizeDisplay = formatSizeDisplay()
  const detailItems = [
    { label: t('fileDetail.labelName'), value: displayFile.displayName },
    ...(sizeDisplay
      ? [{ label: t('fileDetail.labelSize'), value: sizeDisplay }]
      : []),
    { label: t('fileDetail.labelLocation'), value: formatFileLocation() },
    { label: t('fileDetail.labelUploadTime'), value: formatTime(displayFile.uploadTime) },
    {
      label: t('fileDetail.labelLastAccess'),
      value: displayFile.lastAccessTime
        ? formatTime(displayFile.lastAccessTime)
        : '-',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-[500px]'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('fileDetail.detailTitle')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6'>
          <div className='flex justify-center'>
            <FileIcon
              type={displayFile.isDir ? 'dir' : displayFile.suffix || ''}
              size={100}
            />
          </div>

          <DescriptionFieldList className='gap-4'>
            {loading ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <DescriptionField key={i}>
                    <Skeleton className='h-3 w-20' />
                    <Skeleton className='h-4 w-full' />
                  </DescriptionField>
                ))}
              </>
            ) : (
              detailItems.map((item, index) => (
                <DescriptionField
                  key={index}
                  className='border-b border-border/60 pb-3 last:border-b-0 last:pb-0'
                >
                  <DescriptionFieldLabel className='font-mono text-[11px] tracking-wider uppercase'>
                    {item.label}
                  </DescriptionFieldLabel>
                  <DescriptionFieldValue
                    breakAll
                    className={
                      index === 0
                        ? 'font-medium'
                        : 'font-mono text-[13px] tabular-nums text-text-secondary'
                    }
                  >
                    {item.value}
                  </DescriptionFieldValue>
                </DescriptionField>
              ))
            )}
          </DescriptionFieldList>
        </div>
      </DialogContent>
    </Dialog>
  )
}
