/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect } from 'react'
import { getDragState } from '@/lib/drag-layer'

/**
 * 「边缘唤醒」—— 拖到屏幕边缘时自动把目标面板带出来。
 * ============================================================
 *
 * 这是用户要的「工作空间 / 聊天 / 备忘录 三者无缝切换」的关键一环：
 *   想把一个文件发给聊天 → 不用先关掉文件页、再打开聊天、再拖一次。
 *   直接把文件**拖到屏幕右侧边缘**，聊天窗自己滑出来，松手即发送。
 *
 * 三种拖拽的唤醒目标：
 *   file    → 聊天窗（右侧）
 *   memo    → 聊天窗（右侧）
 *   message → 文件页 / 备忘录（左侧）
 *
 * 触发条件（都要满足，避免误触）：
 *   · 正在拖拽（getDragState().kind !== null）
 *   · 指针进入边缘热区（默认 44px）
 *   · 在该热区内**停留** 260ms —— 划过不算，这也避免手抖误开
 *
 * 只调用调用方给的回调，不直接操作任何 store ——
 * 打开哪个面板是业务决定，这个 hook 只负责"检测到意图"。
 */

export type EdgeWakeSide = 'left' | 'right'

const EDGE_PX = 44
const DWELL_MS = 260

export function useEdgeWake(options: {
  enabled?: boolean
  onWake: (side: EdgeWakeSide, kind: 'memo' | 'file' | 'message' | 'os-file') => void
  /** 哪些拖拽种类会触发右侧唤醒；默认 memo + file */
  rightKinds?: Array<'memo' | 'file' | 'message' | 'os-file'>
  /** 哪些拖拽种类会触发左侧唤醒；默认 message */
  leftKinds?: Array<'memo' | 'file' | 'message' | 'os-file'>
}) {
  const {
    enabled = true,
    onWake,
    rightKinds = ['memo', 'file'],
    leftKinds = ['message', 'memo'],
  } = options

  useEffect(() => {
    if (!enabled) return

    let side: EdgeWakeSide | null = null
    let timer = 0
    let fired: EdgeWakeSide | null = null

    const clear = () => {
      window.clearTimeout(timer)
      timer = 0
      side = null
      fired = null
    }

    /** 只有当指针**进入了新的边缘**时才重新计时 */
    const enter = (next: EdgeWakeSide, kind: NonNullable<ReturnType<typeof getDragState>['kind']>) => {
      if (side === next) return
      window.clearTimeout(timer)
      side = next
      fired = null
      timer = window.setTimeout(() => {
        if (fired === next) return
        fired = next
        onWake(next, kind)
      }, DWELL_MS)
    }

    const onDragOver = (event: DragEvent) => {
      const { kind } = getDragState()
      if (!kind) {
        clear()
        return
      }
      const w = window.innerWidth
      const x = event.clientX

      if (x >= w - EDGE_PX && rightKinds.includes(kind)) {
        enter('right', kind)
        return
      }
      if (x <= EDGE_PX && leftKinds.includes(kind)) {
        enter('left', kind)
        return
      }
      clear()
    }

    /*
      ⚠️ 必须监听 window 的捕获阶段。
      拖拽时指针大部分时间在某个落点元素上，dragover 会先派发给它们；
      用捕获能保证边缘检测不被 stopPropagation 吃掉
      （落点里普遍有 event.stopPropagation()）。
    */
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('dragend', clear, true)
    window.addEventListener('drop', clear, true)

    return () => {
      clear()
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('dragend', clear, true)
      window.removeEventListener('drop', clear, true)
    }
  }, [enabled, onWake, rightKinds, leftKinds])
}
