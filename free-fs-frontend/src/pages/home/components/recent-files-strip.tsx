/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesUnit,
} from '@/api/home'
import type { FileItem } from '@/types/file'
import { FileIcon } from '@/components/file-icon'
import { formatFileSize } from '@/utils/format'
import { openFilePreview, originFromTarget } from '@/utils/preview'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 最近文件：demo 的横向缩略图条（.a-hstrip）。
 * 右侧渐隐遮罩本身就是「可以横向滚动」的提示。
 * 与存储卡共用 homeInfo 的 queryKey，不会多发一次请求。
 *
 * 点击行为与「文件」页保持一致：
 *   文件 → 就地打开预览弹窗（不跳页、不切目录）
 *   文件夹 → 才跳转到该目录
 */
export function RecentFilesStrip({ unit }: { unit: HomeUsedBytesUnit }) {
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, unit],
    queryFn: () => getHomeInfo({ unit }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const files = data?.recentFiles ?? []
  const visible = files.slice(0, 12)
  const navigationFiles = visible.filter((file) => !file.isDir)

  const activate = (file: FileItem, target: EventTarget | null) => {
    if (file.isDir) {
      navigate(`/w/${slug}/files?parentId=${file.id}`)
      return
    }
    openFilePreview(file, {
      navigationFiles,
      origin: originFromTarget(target) ?? null,
    })
  }

  if (isLoading) {
    return (
      <div className='a-hstrip'>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-[156px] w-[124px] shrink-0 rounded-[13px]' />
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className='flex h-[156px] items-center justify-center text-[13px] text-text-muted'>
        {t('recentFiles.empty')}
      </div>
    )
  }

  return (
    <div className='a-hstrip'>
      {visible.map((f) => (
        <button
          key={f.id}
          type='button'
          data-file-id={f.id}
          className='a-mini-file a-hoverable'
          title={f.displayName}
          onClick={(event) => activate(f, event.currentTarget)}
        >
          <div className='a-mini-file__thumb'>
            <FileIcon type={f.isDir ? 'dir' : f.suffix} size={68} />
          </div>
          <div className='a-mini-file__name'>{f.displayName}</div>
          <div className='a-mini-file__meta'>
            {f.isDir ? '文件夹' : formatFileSize(f.size)}
          </div>
        </button>
      ))}
    </div>
  )
}
