/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { FileUp, MessageSquarePlus, StickyNote } from 'lucide-react'
import { useDragState } from '@/hooks/use-drag-layer'
import { cn } from '@/lib/utils'

/**
 * 拖拽落点遮罩：所有落点共用同一套视觉，避免「每个面板自己画一个」。
 *
 * 设计要点（对齐 demo）：
 *   · 只动 opacity / transform，不做布局抖动
 *   · 文案是「松开会发生什么」，不是「拖到这里」
 *   · 图标按拖拽种类切换：备忘录 / 工作空间文件 / 对话消息 / 系统文件
 */
export function DropOverlay({
  /** 该落点是否正被悬停 */
  active,
  /** 落点自报的动作文案，例如「发进这个对话」 */
  label,
  className,
  /** compact = 小落点（会话行、树节点）用的轻量版 */
  compact = false,
}: {
  active: boolean
  label: string
  className?: string
  compact?: boolean
}) {
  const { kind } = useDragState()
  const Icon =
    kind === 'memo'
      ? StickyNote
      : kind === 'message'
        ? MessageSquarePlus
        : FileUp

  return (
    <div
      aria-hidden
      className={cn(
        'drag-drop-hint pointer-events-none',
        compact ? 'drag-drop-hint--compact' : 'drag-drop-hint--full',
        active && 'is-active',
        className
      )}
    >
      <span className='drag-drop-hint__ico'>
        <Icon className={compact ? 'size-3.5' : 'size-[18px]'} strokeWidth={1.9} />
      </span>
      <span className='drag-drop-hint__text'>{label}</span>
    </div>
  )
}
