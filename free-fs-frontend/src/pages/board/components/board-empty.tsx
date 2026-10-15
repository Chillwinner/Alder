/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  icon: ReactNode
  title: string
  hint?: string
  className?: string
}

/**
 * demo 那种「图标底座 + 主文案 + 次级说明」的柔和空态。
 * 纯展示组件：没有任何事件与数据依赖。
 */
export function BoardEmpty({ icon, title, hint, className }: Props) {
  return (
    <div
      className={cn(
        'board-empty flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      <span className='relative mb-3.5 grid size-14 shrink-0 place-items-center rounded-full bg-surface-secondary text-text-muted ring-1 ring-border/60'>
        <span className='absolute -inset-1.5 rounded-full bg-accent-soft' aria-hidden />
        <span className='relative grid place-items-center'>{icon}</span>
      </span>
      <p className='text-[13.5px] font-semibold tracking-[-0.01em] text-foreground'>{title}</p>
      {hint ? (
        <p className='mt-1.5 max-w-[26ch] text-[12.5px] leading-relaxed text-text-muted'>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
