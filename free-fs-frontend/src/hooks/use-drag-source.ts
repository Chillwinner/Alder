/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { beginDrag, endDrag, subscribeDrag, type DragKind } from '@/lib/drag-layer'
import { clearMemoDragCache } from '@/components/messages/im-drop-files'
import { useDragState } from '@/hooks/use-drag-layer'

/**
 * 统一的「拖拽源」行为 —— 让任何可拖元素自动获得三件事。
 * ============================================================
 *
 * 为什么需要它：
 *   CSS 里 `.drag-source-active`（抬起 + 倾斜）与
 *   `.drag-source-dropready`（有落点接得住时描边）**早就写好了**，
 *   但全仓 0 处使用 —— 每个拖拽源都只调了 beginDrag/endDrag，
 *   没有把「正在拖」这个状态接到自己的 className 上。
 *   结果就是：能拖能放，但**全程没有任何视觉反馈**。
 *
 * 三件事：
 *   ① 拖起时      → 加 .drag-source-active（变暗 0.55 + 缩小 0.97 + 倾斜 -1.2°）
 *   ② 有落点悬停时 → 加 .drag-source-dropready（主色描边 + 加重阴影）
 *   ③ 结束时      → 全部撤掉
 *
 * 用法：
 *   const drag = useDragSource('memo')
 *   <article {...drag.bind} className={cn(drag.className, '...')} />
 *
 * 注意 bind 里已经包含了 draggable / onDragStart / onDragEnd，
 * 不要再单独写一遍（否则会覆盖）。
 */
export function useDragSource(kind: Exclude<DragKind, null>) {
  /** 本元素是否正被拖拽 */
  const [dragging, setDragging] = useState(false)
  const { target } = useDragState()

  useEffect(() => {
    return subscribeDrag((state) => {
      if (!state.kind) setDragging(false)
    })
  }, [])

  /** 有任意落点正悬停 → 源需要高亮「可以放下」 */
  const dropReady = dragging && target !== null

  const className = useMemo(() => {
    const parts: string[] = []
    if (dragging) parts.push('drag-source-active')
    if (dropReady) parts.push('drag-source-dropready')
    return parts.join(' ')
  }, [dragging, dropReady])

  /**
   * 把 dataTransfer 的写入交给调用方（不同源写不同的 MIME），
   * 这里只负责状态与事件生命周期。
   */
  const onDragStart = useCallback(
    (event: React.DragEvent, writeData: (dt: DataTransfer) => void) => {
      if (!event.dataTransfer) return
      writeData(event.dataTransfer)
      event.dataTransfer.effectAllowed = kind === 'memo' ? 'copyMove' : 'move'
      beginDrag(event, kind)
      setDragging(true)
    },
    [kind]
  )

  const onDragEnd = useCallback(() => {
    setDragging(false)
    if (kind === 'memo') clearMemoDragCache()
    endDrag()
  }, [kind])

  const bind = useMemo(
    () => ({ draggable: true as const, onDragStart, onDragEnd }),
    [onDragStart, onDragEnd]
  )

  return { bind, className, dragging, dropReady }
}
