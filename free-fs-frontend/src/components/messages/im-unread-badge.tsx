/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'

export function imUnreadBadgeClasses(muted?: boolean) {
  return muted
    ? 'bg-muted-foreground text-background'
    : 'bg-destructive text-destructive-foreground'
}

type ImUnreadBadgeProps = {
  count: number
  muted?: boolean
  className?: string
}

export function ImUnreadBadge({ count, muted, className }: ImUnreadBadgeProps) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 font-mono text-[9px] leading-none font-medium tabular-nums',
        imUnreadBadgeClasses(muted),
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
