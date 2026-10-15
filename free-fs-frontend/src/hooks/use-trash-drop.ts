/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useRef, useState } from 'react'
import { deleteFiles } from '@/api/file'
import { deleteWorkspaceMemo } from '@/api/workspace-board'
import { enterDropTarget, leaveDropTarget } from '@/lib/drag-layer'
import {
  collectMemoDrag,
  collectWorkspaceFileDrag,
  isMemoDrag,
  isWorkspaceFileDrag,
} from '@/components/messages/im-drop-files'

/**
 * 拖到「回收站」删除 —— 就像 Windows 上把文件拖进回收站。
 * ============================================================
 *
 * 收两种拖拽：
 *   · 工作空间文件 → DELETE /apis/file          （进回收站，可恢复）
 *   · 备忘录       → DELETE /apis/workspace-board/memos/{id}
 *
 * ⚠️ 备忘录**没有回收站**（后端只有硬删除接口），所以文案必须区分开，
 *    否则用户以为能找回。files 走"移到回收站"，memo 走"删除且不可恢复"。
 *
 * 交互细节（对齐 Windows）：
 *   · 拖到上方时垃圾桶图标变红 + 轻微放大 + 盖子掀开
 *   · 松手后播放一次「吞入」动画再复位
 *   · 只接受拖拽中，普通 hover 不响应
 */
export type TrashDropKind = 'file' | 'memo'

/** 待确认的删除载荷（松手后暂存，确认框点「确认」才执行） */
export type PendingTrashDelete = {
  kind: TrashDropKind
  ids: string[]
  names: string[]
}

export function useTrashDrop(options: {
  /** 删除成功后的回调（刷新列表：文件页刷新文件、备忘录刷新列表） */
  onDeleted?: (kind: TrashDropKind, count: number) => void
}) {
  const { onDeleted } = options
  const [isOver, setIsOver] = useState(false)
  /** 松手后播放"吞入"动画的一次性标记 */
  const [justDropped, setJustDropped] = useState(false)
  /** 松手暂存的待确认删除；非 null 时确认框应打开 */
  const [pending, setPending] = useState<PendingTrashDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const depthRef = useRef(0)

  const reset = useCallback(() => {
    depthRef.current = 0
    setIsOver(false)
  }, [])

  /** 这次拖拽能不能删？同时返回种类，供 UI 决定图标与文案 */
  const readKind = useCallback((event: React.DragEvent): TrashDropKind | null => {
    if (isWorkspaceFileDrag(event)) return 'file'
    if (isMemoDrag(event)) return 'memo'
    return null
  }, [])

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      const kind = readKind(event)
      if (!kind) return
      event.preventDefault()
      event.stopPropagation()
      depthRef.current += 1
      setIsOver(true)
      // 广播给拖拽源：源卡片据此显示"可放下"描边
      enterDropTarget(event, 'trash', kind === 'memo' ? '删除备忘录' : '移到回收站')
    },
    [readKind]
  )

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      const kind = readKind(event)
      if (!kind) return
      event.preventDefault()
      event.stopPropagation()
      // move：跨区域搬运的语义（不是复制）
      event.dataTransfer.dropEffect = 'move'
    },
    [readKind]
  )

  const onDragLeave = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1)
    if (depthRef.current === 0) {
      setIsOver(false)
      leaveDropTarget('trash')
    }
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const kind = readKind(event)
      if (!kind) return
      event.preventDefault()
      event.stopPropagation()
      reset()
      leaveDropTarget('trash')

      /*
        ⚠️ 松手后**不立即删除**，而是暂存载荷 → 弹确认框。
        ------------------------------------------------------------------
        两个理由（都是用户明确提出要加的）：
          · 文件是**多人协作**的工作空间资源 —— 拖一下就把别人的文件删了太危险
          · 备忘录**没有回收站**（后端只有硬删除），删了找不回来
        Windows 拖进回收站不需要确认，那管的是本机文件；
        这里是共享工作空间，语义不同，必须拦一道。
      */
      if (kind === 'file') {
        const { files } = collectWorkspaceFileDrag(event)
        if (!files.length) return
        setPending({ kind: 'file', ids: files.map((f) => f.id), names: files.map((f) => f.name) })
        return
      }

      const memos = collectMemoDrag(event)
      if (!memos.length) return
      setPending({
        kind: 'memo',
        ids: memos.map((m) => m.id),
        names: memos.map((m) => m.title || ''),
      })
    },
    [readKind, reset]
  )

  /** 确认框里点「确认」后才真正执行删除 */
  const confirmDelete = useCallback(async () => {
    if (!pending) return
    setDeleting(true)
    try {
      if (pending.kind === 'file') {
        await deleteFiles(pending.ids)
      } else {
        await Promise.all(pending.ids.map((id) => deleteWorkspaceMemo(id)))
      }
      const { kind, ids } = pending
      setPending(null)
      setJustDropped(true)
      window.setTimeout(() => setJustDropped(false), 520)
      onDeleted?.(kind, ids.length)
    } catch {
      /* 失败静默：onDeleted 不触发，列表保持原样（避免误导为已删除） */
    } finally {
      setDeleting(false)
    }
  }, [pending, onDeleted])

  const cancelDelete = useCallback(() => {
    if (deleting) return
    setPending(null)
  }, [deleting])

  const bind = {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }

  return {
    bind,
    isOver,
    justDropped,
    /** 待确认的删除载荷；null = 没有待确认 */
    pending,
    deleting,
    confirmDelete,
    cancelDelete,
  }
}
