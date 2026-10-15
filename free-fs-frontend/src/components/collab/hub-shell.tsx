/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * 会议页 / 通知页共用的外壳（纯展示，不持有状态）。
 * 版式对齐 demo：
 *   .a-phead 页头（眉标 + 大标题 + 描述 + 右侧 action）
 *   区块 = 标题 + 计数徽标 + 一张整体玻璃卡片
 *   行 = 玻璃行（hover 底色 / 内部分隔线 / 左右插槽）
 */

export function HubPageShell({
  title,
  description,
  eyebrow,
  action,
  children,
}: {
  title: string
  description?: string
  /** 眉标（demo 的 .a-eyebrow）：这一页归属哪个区 */
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className='flex flex-1 flex-col overflow-auto'>
      <div className='mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-6 py-9 sm:px-8'>
        <header className='a-phead'>
          <div className='min-w-0'>
            {eyebrow ? <span className='a-eyebrow'>{eyebrow}</span> : null}
            <h1 className='truncate'>{title}</h1>
            {description ? <p className='a-sub max-w-2xl'>{description}</p> : null}
          </div>
          {action ? <div className='a-phead__right'>{action}</div> : null}
        </header>
        {children}
      </div>
    </div>
  )
}

export function HubSection({
  icon: Icon,
  title,
  count,
  children,
  className,
}: {
  icon?: LucideIcon
  title: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className='flex items-center gap-2.5 px-1'>
        {Icon ? (
          <span className='flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-accent-soft text-primary'>
            <Icon className='size-4' strokeWidth={1.9} />
          </span>
        ) : null}
        <h2 className='min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.024em] text-text-primary'>
          {title}
        </h2>
        {count != null ? (
          <span className='shrink-0 rounded-full bg-surface-secondary px-2.5 py-1 font-mono text-[11px] leading-none font-medium tabular-nums text-text-muted'>
            {count}
          </span>
        ) : null}
      </div>
      {/* 整体一张卡：行与行之间用内部分隔线，不再是一行一张小卡 */}
      <div className='a-glass overflow-hidden rounded-[20px]'>{children}</div>
    </section>
  )
}

export function HubEmpty({
  icon: Icon,
  message,
  hint,
  action,
}: {
  icon: LucideIcon
  message: string
  /** 次级说明（可选） */
  hint?: string
  /** 空态下的操作（可选） */
  action?: ReactNode
}) {
  return (
    <div className='a-glass flex flex-col items-center justify-center rounded-[20px] px-6 py-16 text-center'>
      <span className='mb-4 flex size-14 items-center justify-center rounded-[18px] bg-surface-secondary text-text-muted'>
        <Icon className='size-6' strokeWidth={1.5} />
      </span>
      <p className='text-[15px] font-semibold tracking-[-0.02em] text-text-primary'>{message}</p>
      {hint ? (
        <p className='mt-1.5 max-w-md text-[13px] leading-relaxed text-text-secondary'>{hint}</p>
      ) : null}
      {action ? <div className='mt-5 flex flex-wrap items-center justify-center gap-2'>{action}</div> : null}
    </div>
  )
}

export function HubLoading() {
  return (
    <div className='flex justify-center py-20'>
      <span className='size-6 animate-spin rounded-full border-2 border-muted border-t-primary' />
    </div>
  )
}

export function HubFeedList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('flex flex-col', className)}>{children}</ul>
}

export function HubFeedItem({
  children,
  accent,
  leading,
  trailing,
  className,
}: {
  children: ReactNode
  accent?: 'live' | 'default'
  /** 左侧插槽：时间块 / 图标底座 */
  leading?: ReactNode
  /** 右侧插槽：状态 chip / 未读点 / 行内操作 */
  trailing?: ReactNode
  className?: string
}) {
  return (
    <li
      className={cn(
        'relative border-t border-divider px-4 py-3.5 transition-colors duration-200 first:border-t-0',
        'hover:bg-surface-hover',
        accent === 'live' && 'bg-success/[0.05] hover:bg-success/[0.09]',
        className
      )}
    >
      <div className='flex flex-wrap items-center gap-x-4 gap-y-3'>
        {leading ? <div className='shrink-0'>{leading}</div> : null}
        <div className='min-w-[180px] flex-1'>{children}</div>
        {trailing ? (
          <div className='ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2'>{trailing}</div>
        ) : null}
      </div>
    </li>
  )
}
