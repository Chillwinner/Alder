/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 行图标的语义色（色值只在 settings.css 里引用 token） */
export type SettingsRowTone =
  | 'accent'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'teal'
  | 'amber'
  | 'success'
  | 'warning'
  | 'neutral'

const TONE_CLASS: Record<SettingsRowTone, string> = {
  accent: '',
  blue: 'set-row__ico--blue',
  green: 'set-row__ico--green',
  orange: 'set-row__ico--orange',
  purple: 'set-row__ico--purple',
  red: 'set-row__ico--red',
  teal: 'set-row__ico--teal',
  amber: 'set-row__ico--amber',
  success: 'set-row__ico--success',
  warning: 'set-row__ico--warning',
  neutral: 'set-row__ico--neutral',
}

type SettingsGroupProps = {
  /** 分组标题（可选，通常用于「安全」这类二级分组） */
  label?: string
  /** 分组底注（可选） */
  note?: string
  labelVariant?: 'plain' | 'mono'
  /** 头部行的次级说明（与 label 一起构成 demo 的卡头两行文字） */
  description?: string
  /** 头部行右侧插槽：计数胶囊 / 次要按钮 */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * iOS 设置分组：圆角 24 的容器 + 行间分隔线。
 * 行与行之间用 .set-row + .set-row 的分隔线，不要在外面再套 divide-*。
 * 传了 description / action 时，页眉变成 demo 的卡头行（标题 + 描述 + 右侧插槽）。
 */
export function SettingsGroup({
  label,
  note,
  labelVariant = 'plain',
  description,
  action,
  children,
  className,
}: SettingsGroupProps) {
  const hasHead = Boolean(label && (description || action))
  return (
    <section className={cn('set-group', className)}>
      {hasHead ? (
        <div className='set-group__head'>
          <div className='set-group__head-text'>
            <span className='set-group__head-title'>{label}</span>
            {description ? (
              <span className='set-group__head-desc'>{description}</span>
            ) : null}
          </div>
          {action ? <div className='set-group__head-right'>{action}</div> : null}
        </div>
      ) : label ? (
        <p
          className={cn(
            'set-group__label',
            labelVariant === 'mono' && 'set-group__label--mono'
          )}
        >
          {label}
        </p>
      ) : null}
      {children}
      {note ? <p className='set-group__note'>{note}</p> : null}
    </section>
  )
}

type SettingsRowProps = {
  /** 左侧标题，可传 FormLabel 等节点 */
  label: React.ReactNode
  /** 次级说明 */
  description?: React.ReactNode
  /** 左侧 28–32px 圆角色底图标 */
  icon?: LucideIcon
  tone?: SettingsRowTone
  /** 右侧值（等宽数字展示） */
  value?: React.ReactNode
  /** 右侧箭头 */
  chevron?: boolean
  /** 右侧控件 */
  children?: React.ReactNode
  /** 右侧控件与顶部对齐（多行控件用） */
  align?: 'center' | 'start'
  /** 悬停反馈（只读行也可以给） */
  hover?: boolean
  className?: string
}

/**
 * iOS 设置行：色底图标 + 标题/说明 + 右侧值/控件/箭头。
 * 纯展示行（无控件）也要保留至少一行图标，保证视觉锚点统一。
 */
export function SettingsRow({
  label,
  description,
  icon: Icon,
  tone = 'accent',
  value,
  chevron = false,
  children,
  align = 'center',
  hover = true,
  className,
}: SettingsRowProps) {
  return (
    <div
      data-settings-row=''
      className={cn(
        'set-row',
        hover && 'set-row--hover',
        align === 'start' && 'set-row--start',
        className
      )}
    >
      {Icon ? (
        <span data-settings-row-icon='' className={cn('set-row__ico', TONE_CLASS[tone])}>
          <Icon className='size-4' strokeWidth={1.9} aria-hidden />
        </span>
      ) : null}
      <div className='set-row__body'>
        <span className='set-row__title'>{label}</span>
        {description ? (
          <span className='set-row__desc'>{description}</span>
        ) : null}
      </div>
      {value != null ? <span className='set-row__value'>{value}</span> : null}
      {children ? <div className='set-row__control'>{children}</div> : null}
      {chevron ? (
        <ChevronRight className='set-row__chevron size-4' strokeWidth={2} aria-hidden />
      ) : null}
    </div>
  )
}

type SettingsBlockProps = {
  label: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: SettingsRowTone
  children: React.ReactNode
  className?: string
}

/**
 * 长文案、路径、多行输入等：标题 + 说明在上，控件全宽在下。
 */
export function SettingsBlock({
  label,
  description,
  icon: Icon,
  tone = 'accent',
  children,
  className,
}: SettingsBlockProps) {
  return (
    <div className={cn('set-field', className)}>
      <div className='flex items-start gap-3'>
        {Icon ? (
          <span data-settings-row-icon='' className={cn('set-row__ico', TONE_CLASS[tone])}>
            <Icon className='size-4' strokeWidth={1.9} aria-hidden />
          </span>
        ) : null}
        <div className='set-field__head min-w-0'>
          <span className='set-row__title'>{label}</span>
          {description ? (
            <span className='set-row__desc'>{description}</span>
          ) : null}
        </div>
      </div>
      <div className='w-full min-w-0'>{children}</div>
    </div>
  )
}
