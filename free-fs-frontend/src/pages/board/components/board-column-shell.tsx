/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BoardPagination } from '@/pages/board/components/board-pagination'
import { cn } from '@/lib/utils'

type Props = {
  header: ReactNode
  footerPage: number
  footerTotalPages: number
  onPageChange: (page: number) => void
  children: ReactNode
  className?: string
  dropProps?: HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
  overlay?: ReactNode
}

/**
 * 玻璃列卡（demo「空间资产库」大卡）：
 * 顶部标题行（图标 + 标题 + 计数胶囊 + 操作位）→ 内层分段控件 → 列表 → 底部分页。
 * 只改版式与材质，滚动 / 分页 / 各 handler 的既有行为保持不变。
 */
export function BoardColumnShell({
  header,
  footerPage,
  footerTotalPages,
  onPageChange,
  children,
  className,
  dropProps,
  overlay,
}: Props) {
  return (
    <section
      {...dropProps}
      className={cn(
        'board-column a-glass a-glass--strong relative flex h-[calc(100dvh-15.5rem)] min-h-[440px] w-full max-w-full min-w-0 flex-col overflow-hidden rounded-[22px]',
        className
      )}
    >
      {overlay}
      {header}
      <ScrollArea className='min-h-0 min-w-0 flex-1 overflow-x-hidden [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden! [&_[data-slot=scroll-area-viewport>div]]:block! [&_[data-slot=scroll-area-viewport>div]]:w-full! [&_[data-slot=scroll-area-viewport>div]]:min-w-0!'>
        <div className='box-border w-full max-w-full min-w-0 overflow-x-hidden px-3 pt-2 pb-3 sm:px-3.5'>
          {children}
        </div>
      </ScrollArea>
      <BoardPagination
        page={footerPage}
        totalPages={footerTotalPages}
        onPageChange={onPageChange}
        className='bg-transparent'
      />
    </section>
  )
}

type HeaderProps = {
  icon: ReactNode
  title: string
  count: number
  action: ReactNode
}

/**
 * 列头（demo 卡头分工）：左＝图标底座 + 标题 + 计数胶囊，右＝操作位；
 * 下方一条分隔线把标题行与内容区分开。
 */
export function BoardColumnHeader({ icon, title, count, action }: HeaderProps) {
  return (
    <header className='flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 pt-4 pb-3.5'>
      <div className='flex min-w-0 flex-1 items-center gap-2.5'>
        <span className='grid size-9 shrink-0 place-items-center rounded-[12px] border border-border/50 bg-surface-secondary/70 text-primary backdrop-blur-xl'>
          {icon}
        </span>
        <h2 className='truncate text-[15px] leading-tight font-semibold tracking-tight text-foreground'>
          {title}
        </h2>
        <span className='inline-flex min-h-[20px] min-w-[24px] shrink-0 items-center justify-center rounded-full border border-border/50 bg-surface-secondary/70 px-1.5 font-mono text-[11px] font-medium tabular-nums text-text-secondary backdrop-blur-xl'>
          {count}
        </span>
      </div>
      <div className='shrink-0'>{action}</div>
    </header>
  )
}
