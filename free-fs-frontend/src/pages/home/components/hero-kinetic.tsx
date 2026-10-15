/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'

/**
 * 纯展示组件：hero 的逐字入场标题与统计数字 count-up。
 * 不触碰任何数据源——文案与数值仍由调用方从 i18n / 查询结果传入。
 */

const COUNT_DURATION_MS = 800
const TOKEN_PATTERN = /\d[\d,]*(?:\.\d+)?/

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function splitTokens(text: string) {
  return text.split(new RegExp(`(${TOKEN_PATTERN.source})`, 'g'))
}

function hasDigits(text: string) {
  return TOKEN_PATTERN.test(text)
}

function formatToken(token: string, progress: number) {
  if (progress >= 1) return token
  const dotIndex = token.indexOf('.')
  const decimals = dotIndex === -1 ? 0 : token.length - dotIndex - 1
  const grouped = token.includes(',')
  const target = Number.parseFloat(token.replace(/,/g, ''))
  if (!Number.isFinite(target)) return token
  const eased = 1 - Math.pow(1 - progress, 3)
  const value = target * eased
  if (decimals > 0) {
    const fixed = value.toFixed(decimals)
    if (!grouped) return fixed
    const [intPart, fracPart] = fixed.split('.')
    const int = Number.parseInt(intPart, 10).toLocaleString('en-US')
    return fracPart ? `${int}.${fracPart}` : int
  }
  const rounded = Math.round(value)
  return grouped ? rounded.toLocaleString('en-US') : String(rounded)
}

function frameAt(text: string, progress: number) {
  return splitTokens(text)
    .map((part, index) =>
      index % 2 === 1 ? formatToken(part, progress) : part
    )
    .join('')
}

/** 大标题逐字入场：把文本拆成 span（纯展示拆分，文案不变）。 */
export function KineticTitle({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const chars = Array.from(text)
  return (
    <h1 aria-label={text} className={className}>
      {chars.map((char, index) => (
        <span
          key={`${index}-${char}`}
          aria-hidden='true'
          className='k-char'
          style={{ animationDelay: `${Math.min(index, 40) * 45}ms` }}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </h1>
  )
}

/**
 * 统计行文案：数字部分大号 mono count-up，其余文字保持原文并以小号 mono 标注。
 * 整串 = 传入的原始文案（切分后逐段拼接，最终帧与原文完全一致）。
 */
export function HeroStatText({
  text,
  valueClassName,
  labelClassName,
  className,
}: {
  text: string
  valueClassName?: string
  labelClassName?: string
  className?: string
}) {
  const [display, setDisplay] = React.useState(() =>
    hasDigits(text) && !prefersReducedMotion() ? frameAt(text, 0) : text
  )
  const animatedRef = React.useRef(false)
  const rafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!hasDigits(text)) {
      animatedRef.current = false
      setDisplay(text)
      return
    }
    if (animatedRef.current || prefersReducedMotion()) {
      animatedRef.current = true
      setDisplay(text)
      return
    }
    animatedRef.current = true
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_DURATION_MS)
      setDisplay(frameAt(text, progress))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(text)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [text])

  const parts = splitTokens(display)
  return (
    <span aria-label={text} className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} aria-hidden='true' className={valueClassName}>
            {part}
          </span>
        ) : part === '' ? null : (
          <span key={index} aria-hidden='true' className={labelClassName}>
            {part}
          </span>
        )
      )}
    </span>
  )
}
