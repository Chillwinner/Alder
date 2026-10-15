/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedItem<T extends string> = {
  value: T
  label: React.ReactNode
  ariaLabel?: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  items: SegmentedItem<T>[]
  fill?: boolean
  className?: string
  'aria-label'?: string
}

function useSegThumb(value: string) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const thumb = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    const w = wrap.current
    const th = thumb.current
    if (!w || !th) return
    const active = w.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!active) return
    const measure = () => {
      const wr = w.getBoundingClientRect()
      const ar = active.getBoundingClientRect()
      th.style.width = `${ar.width}px`
      th.style.transform = `translateX(${ar.left - wr.left}px)`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(w)
    ro.observe(active)
    return () => ro.disconnect()
  }, [value])

  return { wrap, thumb }
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  fill,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const { wrap, thumb } = useSegThumb(value)

  return (
    <div
      ref={wrap}
      className={cn('a-seg', fill && 'a-seg--fill', className)}
      role='group'
      aria-label={ariaLabel}
    >
      <span className='a-seg__thumb' ref={thumb} aria-hidden />
      {items.map((item) => (
        <button
          key={item.value}
          type='button'
          aria-label={item.ariaLabel}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
