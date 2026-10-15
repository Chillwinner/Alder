/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  resolveInboxConversationId,
  selectInboxConversation,
} from '@/components/messages/im-conversation-actions'
import { useImStore } from '@/store/im'
import type { ImInboxItem } from '@/types/im'
import { getMessagesPanelLeft, IM_SNAP_THRESHOLD } from '@/utils/im-magnetic-snap'

const DRAG_START_THRESHOLD = 8
const DETACH_DISTANCE = 52

type DragGhost = {
  x: number
  y: number
  label: string
  color: string
  background: string
  avatar?: string | null
  snapBack: boolean
}

type UseAvatarDragDetachOptions = {
  item: ImInboxItem
  title: string
  colors: { color: string; background: string }
  avatar?: string | null
  initials: string
  enabled?: boolean
}

export function useAvatarDragDetach({
  item,
  title,
  colors,
  avatar,
  initials,
  enabled = true,
}: UseAvatarDragDetachOptions) {
  const { t } = useTranslation('messages')
  const openDetachedChat = useImStore((state) => state.openDetachedChat)
  const [ghost, setGhost] = useState<DragGhost | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    dragging: boolean
    railRight: number
  } | null>(null)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled || event.button !== 0) return
      const railRight = event.currentTarget.getBoundingClientRect().right
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        railRight,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [enabled]
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      const dx = event.clientX - drag.startX
      const distance = Math.hypot(dx, event.clientY - drag.startY)

      if (!drag.dragging && distance < DRAG_START_THRESHOLD) return

      drag.dragging = true
      const panelLeft = getMessagesPanelLeft()
      const snapBack =
        panelLeft != null
          ? event.clientX >= panelLeft - IM_SNAP_THRESHOLD
          : event.clientX >= drag.railRight - IM_SNAP_THRESHOLD

      setGhost({
        x: event.clientX,
        y: event.clientY,
        label: title,
        color: colors.color,
        background: colors.background,
        avatar,
        snapBack,
      })
    }

    const onPointerUp = async (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      const wasDragging = drag.dragging
      const dx = event.clientX - drag.startX
      const distance = Math.hypot(dx, event.clientY - drag.startY)
      dragRef.current = null
      setGhost(null)

      if (!wasDragging || distance < DRAG_START_THRESHOLD) {
        void selectInboxConversation(item)
        return
      }

      const panelLeft = getMessagesPanelLeft()
      const snapBack =
        panelLeft != null
          ? event.clientX >= panelLeft - IM_SNAP_THRESHOLD
          : Math.abs(event.clientX - drag.railRight) < IM_SNAP_THRESHOLD

      if (snapBack) {
        void selectInboxConversation(item)
        return
      }

      const pulledOut =
        event.clientX < drag.railRight - 24 || distance >= DETACH_DISTANCE
      if (!pulledOut) {
        void selectInboxConversation(item)
        return
      }

      const conversationId = await resolveInboxConversationId(item)
      if (!conversationId) return
      openDetachedChat(conversationId, { x: event.clientX, y: event.clientY })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [colors.background, colors.color, avatar, item, openDetachedChat, title, t])

  useEffect(() => {
    const panel = document.querySelector('[data-im-messages-panel]')
    if (!panel) return undefined
    if (ghost?.snapBack) {
      panel.setAttribute('data-im-dock-target', 'true')
    } else {
      panel.removeAttribute('data-im-dock-target')
    }
    return () => panel.removeAttribute('data-im-dock-target')
  }, [ghost?.snapBack])

  const ghostNode =
    ghost &&
    createPortal(
      <div
        className='pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-1/2'
        style={{ left: ghost.x, top: ghost.y }}
      >
        <div
          className={[
            'flex flex-col items-center gap-1 transition-transform duration-100',
            ghost.snapBack ? 'scale-90 opacity-80' : 'scale-105',
          ].join(' ')}
        >
          <div
            className={[
              'flex size-11 items-center justify-center rounded-[12px] text-sm font-semibold shadow-lg ring-2',
              ghost.snapBack ? 'ring-primary/70' : 'ring-white/80',
            ].join(' ')}
            style={{ backgroundColor: ghost.background, color: ghost.color }}
          >
            {initials}
          </div>
          <span className='max-w-24 truncate rounded-md bg-black/75 px-2 py-0.5 text-[10px] text-white'>
            {ghost.snapBack ? t('drag.snapBack') : title}
          </span>
        </div>
      </div>,
      document.body
    )

  return {
    onPointerDown,
    dragging: Boolean(ghost),
    ghostNode,
  }
}
