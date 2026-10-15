/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  collectDroppedFiles,
  collectImMessageDrag,
  collectMemoDrag,
  collectWorkspaceFileDrag,
  isImDroppableDrag,
  isImMessageDrag,
  isMemoDrag,
  isWorkspaceFileDrag,
  type ImMessageDragItem,
  type WorkspaceFileDragItem,
} from '@/components/messages/im-drop-files'
import {
  enterDropTarget,
  leaveDropTarget,
  notifyDragLanded,
  useLandTarget,
} from '@/lib/drag-layer'
import type { WorkspaceMemo } from '@/types/workspace-board'

type UseImExternalFileDropOptions = {
  enabled?: boolean
  onFiles: (files: File[]) => void
  onWorkspaceFiles?: (files: WorkspaceFileDragItem[]) => void
  onMemos?: (memos: WorkspaceMemo[]) => void
  onImMessage?: (item: ImMessageDragItem) => void
  onSkippedFolders?: (names: string[]) => void
  /** 落点身份，用于全局拖拽层联动（源卡片高亮 + 统一提示） */
  targetId?: string
  accept?: (event: DragEvent) => boolean
}

export function useImExternalFileDrop({
  enabled = true,
  onFiles,
  onWorkspaceFiles,
  onMemos,
  onImMessage,
  onSkippedFolders,
  targetId,
  accept,
}: UseImExternalFileDropOptions) {
  const [isOver, setIsOver] = useState(false)
  const depthRef = useRef(0)
  const landRef = useLandTarget(targetId)

  const matches = useCallback(
    (event: DragEvent) => {
      if (!enabled) return false
      if (accept) return accept(event)
      return isImDroppableDrag(event) || isImMessageDrag(event)
    },
    [accept, enabled]
  )

  const reset = useCallback(() => {
    depthRef.current = 0
    setIsOver(false)
    if (targetId) leaveDropTarget(targetId)
  }, [targetId])

  // 拖拽在别处结束时（拖出窗口 / ESC 取消）也要清掉悬停态，
  // 否则落点会一直停在「高亮」上。
  useEffect(() => {
    if (!isOver) return
    const clear = () => reset()
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [isOver, reset])

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (!matches(event)) return
      event.preventDefault()
      event.stopPropagation()
      depthRef.current += 1
      setIsOver(true)
      if (targetId) enterDropTarget(event, targetId, null)
    },
    [matches, targetId]
  )

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!matches(event)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
      if (targetId) enterDropTarget(event, targetId, null)
    },
    [matches, targetId]
  )

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (!matches(event)) return
      event.preventDefault()
      event.stopPropagation()
      depthRef.current -= 1
      if (depthRef.current <= 0) reset()
    },
    [matches, reset]
  )

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!matches(event)) return
      event.preventDefault()
      event.stopPropagation()
      reset()
      let landed = false
      if (isImMessageDrag(event)) {
        const item = collectImMessageDrag(event)
        if (item) {
          onImMessage?.(item)
          landed = true
        }
      } else if (isMemoDrag(event)) {
        const memos = collectMemoDrag(event)
        if (memos.length > 0) {
          onMemos?.(memos)
          landed = true
        }
      } else if (isWorkspaceFileDrag(event)) {
        const { files, skippedFolders } = collectWorkspaceFileDrag(event)
        if (skippedFolders.length > 0) onSkippedFolders?.(skippedFolders)
        if (files.length > 0) {
          onWorkspaceFiles?.(files)
          landed = true
        }
      } else {
        const { files, skippedFolders } = collectDroppedFiles(event)
        if (skippedFolders.length > 0) onSkippedFolders?.(skippedFolders)
        if (files.length > 0) {
          onFiles(files)
          landed = true
        }
      }
      if (landed && targetId) notifyDragLanded(targetId)
    },
    [matches, onFiles, onImMessage, onMemos, onSkippedFolders, onWorkspaceFiles, reset, targetId]
  )

  return {
    isOver,
    dropProps: {
      ref: landRef,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  }
}

/**
 * 拖拽开始/结束时同步 <body data-dragging>。
 * 挂在应用级组件上（WorkspaceHost），全站只挂一次。
 */
export function useDragBodyFlag() {
  useEffect(() => {
    const onStart = () => {
      document.body.dataset.dragging = 'true'
    }
    const onEnd = () => {
      delete document.body.dataset.dragging
      void import('@/lib/drag-layer').then((m) => m.endDrag())
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEnd()
    }
    window.addEventListener('dragstart', onStart, true)
    window.addEventListener('dragend', onEnd, true)
    window.addEventListener('drop', onEnd, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('dragstart', onStart, true)
      window.removeEventListener('dragend', onEnd, true)
      window.removeEventListener('drop', onEnd, true)
      window.removeEventListener('keydown', onKey, true)
      delete document.body.dataset.dragging
    }
  }, [])
}
