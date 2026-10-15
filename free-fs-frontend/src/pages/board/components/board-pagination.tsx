/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** iOS 胶囊分页：淡底胶囊 + 圆形翻页键 + mono 页码。行为与原来完全一致。 */
export function BoardPagination({
  page,
  totalPages,
  onPageChange,
  className,
}: Props) {
  const safeTotal = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, page), safeTotal)

  return (
    <div
      className={cn(
        'board-pagination flex shrink-0 items-center justify-center gap-4 py-2.5',
        className
      )}
    >
      <div className='flex items-center gap-0.5 rounded-full bg-surface-secondary p-1'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-9 rounded-full p-0 text-text-secondary shadow-none hover:bg-surface hover:text-foreground'
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className='size-4' />
        </Button>
        <span className='min-w-[3.75rem] text-center font-mono text-[12px] font-medium tabular-nums text-text-secondary'>
          {current} / {safeTotal}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-9 rounded-full p-0 text-text-secondary shadow-none hover:bg-surface hover:text-foreground'
          disabled={current >= safeTotal}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
