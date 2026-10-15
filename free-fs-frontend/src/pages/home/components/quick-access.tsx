/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { LucideIcon } from 'lucide-react'
import { Archive, FileText, Film, Image, Music2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueries } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getFileList } from '@/api/file'
import type { FileType } from '@/types/file'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'

const CATEGORIES: { type: FileType; titleKey: string; icon: LucideIcon }[] = [
  { type: 'document', titleKey: 'category.document', icon: FileText },
  { type: 'image', titleKey: 'category.image', icon: Image },
  { type: 'video', titleKey: 'category.video', icon: Film },
  { type: 'audio', titleKey: 'category.audio', icon: Music2 },
  { type: 'other', titleKey: 'category.other', icon: Archive },
]

export function QuickAccess() {
  const { t } = useTranslation('home')
  const { slug = '' } = useParams<{ slug: string }>()
  const { hasPermission } = usePermission()
  const canRead = hasPermission('file:read')

  const counts = useQueries({
    queries: CATEGORIES.map((item) => ({
      queryKey: ['category-count', slug, item.type],
      queryFn: () => getFileList({ page: 1, pageSize: 1, fileType: item.type }),
      enabled: canRead,
      staleTime: 60_000,
    })),
  })

  return (
    <section>
      <div className='grid grid-cols-1 gap-2'>
        {CATEGORIES.map((item, index) => {
          const Icon = item.icon
          const total = counts[index]?.data?.total
          const isEmpty = total === 0

          const inner = (
            <>
              <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Icon className='size-4' strokeWidth={1.75} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-[13px] font-medium text-text-primary'>
                  {t(item.titleKey)}
                </span>
                <span className='mt-0.5 block truncate font-mono text-[11px] tracking-wider tabular-nums text-text-muted'>
                  {isEmpty
                    ? t('category.empty')
                    : t('category.filesCount', { count: total })}
                </span>
              </span>
              <span className='shrink-0 font-mono text-[18px] leading-none font-semibold tabular-nums text-text-primary transition-colors group-hover:text-primary'>
                {total ?? '—'}
              </span>
            </>
          )

          const base =
            'group relative flex min-h-[56px] items-center gap-3 rounded-[10px] border border-border px-3 py-2 text-left transition-all duration-150'

          /*
            ⚠️ 0 项的分类**不可点**。
            用户反馈"快速访问点了没作用" —— 一半原因就在这里：视频/音频/其他
            都是 0 个文件，点进去是空列表，看起来像坏了。
            置灰 + 去掉 hover 抬升 + 明确写"暂无"，用户一眼就知道是"这里没东西"，
            而不是"按钮坏了"。
          */
          if (isEmpty) {
            return (
              <div
                key={item.type}
                aria-disabled='true'
                className={cn(base, 'cursor-not-allowed border-dashed bg-surface/30 opacity-55')}
              >
                {inner}
              </div>
            )
          }

          return (
            <Link
              key={item.type}
              to={`/w/${slug}/files?type=${item.type}`}
              className={cn(
                base,
                'bg-surface-secondary/60 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-hover active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
