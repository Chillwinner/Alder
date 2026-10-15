/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'

/** 设置各面板顶部眉标（对应 demo 的小标签） */
export function SettingsPageEyebrow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('a-eyebrow', className)} {...props}>
      {children}
    </p>
  )
}

/** 设置各页顶部一级标题（对应 md 的 #） */
export function SettingsPageTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-[27px] font-semibold leading-tight tracking-[-0.03em] text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </h2>
  )
}

/** 一级标题下的说明文字 */
export function SettingsPageDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'mt-1.5 text-[13.5px] leading-relaxed text-text-secondary',
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}
