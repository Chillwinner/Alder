/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import {
  getDragState,
  subscribeDrag,
  type DragKind,
  type DropTargetId,
} from '@/lib/drag-layer'

/** 当前正在拖什么（kind）+ 悬在哪个落点上（target） */
export function useDragState() {
  const [state, setState] = useState(getDragState)
  useEffect(() => subscribeDrag(setState), [])
  return state
}

/** 是否正在拖拽（任意种类） */
export function useIsDragging() {
  return useDragState().kind !== null
}

/**
 * 这个落点正被悬停吗。
 * prefix 用于「一类落点」（如 'chat' 会匹配 'chat:12'、'chat:ai'）。
 */
export function useDropTargetActive(prefix: string) {
  const { target } = useDragState()
  return target?.startsWith(prefix) ?? false
}

/** 拖拽种类是否符合预期（用于只在该类拖拽时显示提示） */
export function useDragKind(...kinds: Exclude<DragKind, null>[]) {
  const { kind } = useDragState()
  return kind !== null && kinds.includes(kind)
}

export type { DropTargetId }
