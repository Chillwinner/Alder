/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'

type AnimatedNumberProps = {
  value: number
  /** 滚动时长 ms */
  duration?: number
  className?: string
  format?: (n: number) => string
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * 数字滚动：值变化时从旧值平滑滚到新值（首次挂载从 0 起）。
 * 只重绘文本节点，不影响布局；prefers-reduced-motion 下直接跳到终值。
 */
export function AnimatedNumber({
  value,
  duration = 700,
  className,
  format = (n) => Math.round(n).toLocaleString(),
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      fromRef.current = value
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const next = from + (value - from) * easeOutExpo(t)
      fromRef.current = next
      setDisplay(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
