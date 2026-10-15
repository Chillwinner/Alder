/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'
import { FileIcon } from '@/components/file-icon'

export function FileTypeIcon({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-surface-secondary',
        className
      )}
    >
      <FileIcon type={type} size={20} />
    </span>
  )
}
