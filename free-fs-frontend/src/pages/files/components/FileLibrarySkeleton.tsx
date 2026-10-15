/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAME_WIDTHS = ['w-[68%]', 'w-[54%]', 'w-[76%]', 'w-[61%]', 'w-[49%]', 'w-[71%]', 'w-[58%]', 'w-[64%]']

type Props = {
  variant?: 'grid' | 'list'
  rows?: number
  className?: string
}

/** 文件库首屏加载：跟列表/网格同形的骨架，不再居中转圈。 */
export function FileLibrarySkeleton({ variant = 'grid', rows = 8, className }: Props) {
  const { t } = useTranslation('common')

  if (variant === 'grid') {
    return (
      <div className={cn('p-1', className)} aria-busy='true' aria-live='polite'>
        <span className='sr-only'>{t('loading')}</span>
        <div className='a-fgrid'>
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className='a-fcard pointer-events-none'>
              <div className='a-fcard__inner'>
                <div className='a-fcard__top'>
                  <Skeleton className='size-11 rounded-[10px]' />
                </div>
                <Skeleton className={cn('h-3.5 max-w-full', NAME_WIDTHS[index % NAME_WIDTHS.length])} />
                <div className='a-fcard__meta'>
                  <Skeleton className='h-2.5 w-10' />
                  <Skeleton className='h-2.5 w-16' />
                </div>
                <div className='a-fcard__foot'>
                  <Skeleton className='h-2.5 w-12' />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)} aria-busy='true' aria-live='polite'>
      <span className='sr-only'>{t('loading')}</span>
      <div className='fs-listcard overflow-hidden rounded-lg border border-border bg-card'>
        <div className='flex h-[42px] items-center gap-3 border-b border-border/60 px-3'>
          <Skeleton className='size-4 shrink-0' />
          <Skeleton className='h-2.5 w-14' />
          <Skeleton className='ml-auto hidden h-2.5 w-10 sm:block' />
          <Skeleton className='hidden h-2.5 w-10 sm:block' />
          <Skeleton className='hidden h-2.5 w-16 md:block' />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className='flex min-h-[52px] items-center gap-3 border-b border-border/50 px-3 last:border-b-0'
          >
            <Skeleton className='size-4 shrink-0' />
            <Skeleton className='size-7 shrink-0 rounded-[6px]' />
            <Skeleton className={cn('h-3.5 max-w-[14rem] flex-1', NAME_WIDTHS[index % NAME_WIDTHS.length])} />
            <Skeleton className='hidden h-2.5 w-10 sm:block' />
            <Skeleton className='hidden h-2.5 w-12 sm:block' />
            <Skeleton className='hidden h-2.5 w-[4.5rem] md:block' />
          </div>
        ))}
      </div>
    </div>
  )
}
