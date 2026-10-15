/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { notifyDragLanded, subscribeDrag, useLandTarget } from '@/lib/drag-layer'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { saveImMessageToWorkspace } from '@/api/im'
import {
  collectImMessageDrag,
  collectMemoDrag,
  isImMessageDrag,
  isMemoDrag,
  type ImMessageDragItem,
} from '@/components/messages/im-drop-files'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { translateServerText } from '@/i18n'

export function useSaveImToWorkspace(onSaved?: () => void) {
  const { t } = useTranslation('messages')
  const queryClient = useQueryClient()

  const save = useCallback(
    async (item: ImMessageDragItem, parentId?: string) => {
      const saved = await saveImMessageToWorkspace({
        conversationId: item.conversationId,
        messageId: item.messageId,
        parentId,
      })
      toast.success(t('room.savedToWorkspace'))
      void queryClient.invalidateQueries({ queryKey: ['homeInfo'] })
      void queryClient.invalidateQueries({ queryKey: ['workspace-board'] })
      onSaved?.()
      return saved
    },
    [onSaved, queryClient, t]
  )

  return { save }
}

export function useImMessageWorkspaceDrop(
  enabled: boolean,
  onDrop: (item: ImMessageDragItem) => void,
  onMemoDrop?: (memos: WorkspaceMemo[]) => void,
  acceptIm = true,
  targetId?: string
) {
  const [isOver, setIsOver] = useState(false)
  const landRef = useLandTarget(targetId)

  useEffect(() => {
    return subscribeDrag((state) => {
      if (!state.kind) setIsOver(false)
    })
  }, [])

  const accepts = useCallback(
    (event: DragEvent) => {
      if (!enabled) return false
      if (acceptIm && isImMessageDrag(event)) return true
      return Boolean(onMemoDrop) && isMemoDrag(event)
    },
    [acceptIm, enabled, onMemoDrop]
  )

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      setIsOver(true)
    },
    [accepts]
  )

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
    },
    [accepts]
  )

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      const next = event.relatedTarget as Node | null
      if (next && event.currentTarget.contains(next)) return
      setIsOver(false)
    },
    [accepts]
  )

  const handleDrop = useCallback(
    (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.stopPropagation()
      setIsOver(false)
      let landed = false
      if (isMemoDrag(event)) {
        const memos = collectMemoDrag(event)
        if (memos.length > 0) {
          onMemoDrop?.(memos)
          landed = true
        }
      } else {
        const item = collectImMessageDrag(event)
        if (item) {
          onDrop(item)
          landed = true
        }
      }
      if (landed && targetId) notifyDragLanded(targetId)
    },
    [accepts, onDrop, onMemoDrop, targetId]
  )

  return {
    isOver,
    dropProps: {
      ref: landRef,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop: handleDrop,
    },
  }
}

export function reportImSaveFailed(cause: unknown, fallback: string) {
  toast.error(cause instanceof Error ? translateServerText(cause.message) : fallback)
}
