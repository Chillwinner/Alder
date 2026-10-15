/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef } from 'react'
import {
  FREEFS_IM_MESSAGE_MIME,
  FREEFS_MEMOS_MIME,
  FREEFS_WORKSPACE_FILES_MIME,
  isExternalFileDrag,
  isImDroppableDrag,
  isImMessageDrag,
  isMemoDrag,
  isWorkspaceFileDrag,
} from '@/components/messages/im-drop-files'

/**
 * 拖拽中「这东西是什么」的全局信号层。
 *
 * 为什么需要它：
 *   三向拖拽（备忘录 ⇄ 工作空间文件 ⇄ 对话）的**落点**分散在
 *   三个互不相干的组件树里（看板卡片、文件库、聊天窗、AI 面板）。
 *   每个落点都能从 dataTransfer.types 判断自己收不收，
 *   但**拖拽源自己**不知道「现在谁在接我」——它需要被高亮。
 *
 *   这里只做两件事，且都**不碰 dataTransfer**（读写 dataTransfer
 *   在部分浏览器会打断原生拖拽）：
 *     1. 广播「当前拖的是什么」→ 所有可落点顺手读一下，决定要不要亮
 *     2. 广播「当前悬在哪个落点上」→ 源卡片据此加高亮
 *
 *   落点仍然各自调用既有的 collectXxxDrag 取数据，行为不变。
 */

/** 拖拽载荷的种类。origin 只是给提示文案用，不参与业务判断。 */
export type DragKind = 'memo' | 'file' | 'message' | 'os-file' | null

/** 落点身份，用于「源高亮」时匹配 */
export type DropTargetId = string

type DragState = {
  kind: DragKind
  /** 当前悬停的落点；null = 没在任何落点上 */
  target: DropTargetId | null
  /** 落点自报的「松开会发生什么」，用于提示气泡 */
  hint: string | null
}

const EMPTY: DragState = { kind: null, target: null, hint: null }

let state: DragState = EMPTY
const listeners = new Set<(s: DragState) => void>()

function emit(next: DragState) {
  // 浅比较，避免同一状态反复通知导致无谓重渲染
  if (
    next.kind === state.kind &&
    next.target === state.target &&
    next.hint === state.hint
  ) {
    return
  }
  state = next
  for (const listener of listeners) listener(state)
}

export function subscribeDrag(listener: (s: DragState) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDragState() {
  return state
}

/** 从 dataTransfer.types 推断拖拽种类（不读 data，安全） */
export function kindFromTransfer(event: {
  dataTransfer?: DataTransfer | null
}): DragKind {
  if (!event?.dataTransfer) return null
  if (isMemoDrag(event as never)) return 'memo'
  if (isWorkspaceFileDrag(event as never)) return 'file'
  if (isImMessageDrag(event as never)) return 'message'
  if (isExternalFileDrag(event as never)) return 'os-file'
  return null
}

/** 拖拽源在 onDragStart 里调用 */
export function beginDrag(
  event: { dataTransfer?: DataTransfer | null },
  fallback?: DragKind
) {
  emit({ kind: kindFromTransfer(event) ?? fallback ?? null, target: null, hint: null })
}

/** 任何 dragend / drop 之后都要调用，否则会残留「拖拽中」状态 */
export function endDrag() {
  emit(EMPTY)
}

/**
 * 落点在 onDragEnter/onDragOver 里调用，声明「我能收」并给出提示文案。
 * 返回 true 表示这个落点接受了当前拖拽（调用方据此决定是否 preventDefault）。
 */
export function enterDropTarget(
  event: { dataTransfer?: DataTransfer | null },
  target: DropTargetId,
  hint: string | null
) {
  const kind = kindFromTransfer(event)
  if (!kind) return false
  emit({ kind, target, hint })
  return true
}

/** 落点在 onDragLeave / onDrop 里调用 */
export function leaveDropTarget(target: DropTargetId) {
  if (state.target !== target) return
  emit({ ...state, target: null, hint: null })
}

/**
 * 这个落点是不是「我这类的」落点？
 * 源卡片用它来决定要不要高亮自己（例如备忘录卡片只在
 * 文件库/对话被悬停时高亮，而不是任意落点都亮）。
 */
export function isDropTargetActive(prefix: string) {
  return state.target?.startsWith(prefix) ?? false
}

/* ============================================================
   「落位回弹」—— 松手后目标位置弹一下
   ------------------------------------------------------------
   原生拖拽 drop 之后没有任何反馈：东西凭空出现在新位置，
   用户不确定"到底放成功了没"。iOS 的做法是让**接收方**做一个
   短促的弹性缩放（弹一下），确认"我收到了"。

   实现：注册表 + Web Animations API。
     ① 每个落点组件在 mount 时 registerLandTarget(id, el)，
        落点自己拿到 DOM 引用
     ② 业务代码在 onDrop 成功后调 notifyDragLanded(id)，
        由这里直接对那个 DOM 元素播放动画
   不走全局 React state（drop 后立刻触发一次重渲染没有意义），
   也不加/删 className（会和 React 的 className 打架）。
   ============================================================ */

const landTargets = new Map<string, () => Element | null>()

/** 落点组件注册自己（返回注销函数） */
export function registerLandTarget(
  id: string,
  resolve: () => Element | null
) {
  landTargets.set(id, resolve)
  return () => {
    if (landTargets.get(id) === resolve) landTargets.delete(id)
  }
}

/**
 * 播放一次「落位回弹」。
 *
 * 用 Web Animations API 而不是 CSS animation 的四个理由：
 *   ① 不必给元素加/删 class，不会和 React 的 className 打架
 *   ② 可以 cancel 上一次未播完的，快速连放两次不会卡住
 *   ③ fill: 'none' → 结束后自动回到元素自身样式，不留残留 transform
 *   ④ 和 PressTilt 的弹簧各走各的通道：这里用 scale，
 *      弹簧用 translate/transform，互不覆盖
 */
export function playLandBounce(element: Element | null | undefined) {
  if (!element || typeof window === 'undefined') return
  const el = element as HTMLElement
  if (typeof el.animate !== 'function') return
  try {
    el.animate(
      [
        { scale: '1', offset: 0 },
        { scale: '0.972', offset: 0.28 },
        { scale: '1.008', offset: 0.62 },
        { scale: '1', offset: 1 },
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'none',
      }
    )
  } catch {
    /* 动画失败不影响业务 */
  }
}

/** 落点成功接收后调用（在 onDrop 的业务逻辑里） */
export function notifyDragLanded(id: string) {
  const resolve = landTargets.get(id)
  if (!resolve) return
  playLandBounce(resolve())
}

/** 落点组件：注册 DOM，drop 成功后用 notifyDragLanded(id) 弹一下。 */
export function useLandTarget(id: string | undefined) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!id) return
    return registerLandTarget(id, () => ref.current)
  }, [id])
  return ref
}

export { isImDroppableDrag, FREEFS_MEMOS_MIME, FREEFS_WORKSPACE_FILES_MIME, FREEFS_IM_MESSAGE_MIME }
