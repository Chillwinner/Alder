/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NotificationDismissButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type='button'
      className={cn(
        'absolute top-1.5 right-1.5 z-10 inline-flex size-6 items-center justify-center rounded-md',
        'text-muted-foreground/80 hover:bg-muted hover:text-foreground',
        className
      )}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <X className='size-3.5' strokeWidth={2} />
    </button>
  )
}