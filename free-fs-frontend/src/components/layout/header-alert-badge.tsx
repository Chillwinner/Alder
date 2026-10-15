/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type HeaderAlertBadgeProps = {
  count: number
  alerting: boolean
  className?: string
}

export function HeaderAlertBadge({ count, alerting, className }: HeaderAlertBadgeProps) {
  // count 可能是 undefined / NaN（后端未返回 total 时），必须在这里收口，
  // 否则会渲染出字面量「undefined」。
  if (!Number.isFinite(count) || count <= 0) return null
  const label = count > 99 ? '99+' : String(count)

  return (
    <>
      {alerting ? (
        /* iOS 的提醒是「轻轻呼吸」，不是一坨扩散的光晕 */
        <span aria-hidden className='a-badge-ring' />
      ) : null}
      <Badge
        variant='destructive'
        className={cn(
          'absolute -top-0.5 -right-0.5 z-[1] flex h-4 min-w-4 items-center justify-center px-1 text-[10px] transition-transform duration-300',
          alerting && 'header-alert-badge-glow scale-110',
          className
        )}
      >
        {label}
      </Badge>
    </>
  )
}
