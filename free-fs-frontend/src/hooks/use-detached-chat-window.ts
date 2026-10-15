/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PanelRect, ResizeEdge } from '@/hooks/use-floating-panel'
import { clampRect } from '@/hooks/use-floating-panel'
import {
  applyMagneticSnap,
  getMessagesPanelLeft,
  snapRectOnRelease,
} from '@/utils/im-magnetic-snap'
import {
  DETACHED_CHAT_MIN_H,
  DETACHED_CHAT_MIN_W,
} from '@/utils/im-detached-chat-layout'

type DragState = {
  mode: 'move' | 'resize'
  edge?: ResizeEdge
  startX: number
  startY: number
  origin: PanelRect
  pointerId: number
}

function resizeFromEdge(
  origin: PanelRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minW: number,
  minH: number
): PanelRect {
  let { x, y, w, h } = origin

  if (edge.includes('e')) w = origin.w + dx
  if (edge.includes('w')) {
    w = origin.w - dx
    x = origin.x + dx
  }
  if (edge.includes('s')) h = origin.h + dy
  if (edge.includes('n')) {
    h = origin.h - dy
    y = origin.y + dy
  }

  if (w < minW) {
    if (edge.includes('w')) x -= minW - w
    w = minW
  }
  if (h < minH) {
    if (edge.includes('n')) y -= minH - h
    h = minH
  }

  return clampRect({ x, y, w, h }, minW, minH)
}

type UseDetachedChatWindowOptions = {
  rect: PanelRect
  onRectChange: (rect: PanelRect) => void
  onDock: () => void
}

export function useDetachedChatWindow({
  rect,
  onRectChange,
  onDock,
}: UseDetachedChatWindowOptions) {
  const [snapping, setSnapping] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const rectRef = useRef(rect)
  rectRef.current = rect

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      const panelLeft = getMessagesPanelLeft()

      if (drag.mode === 'move') {
        const maxX = window.innerWidth - drag.origin.w - 8
        const maxY = window.innerHeight - drag.origin.h - 8
        const next = clampRect(
          {
            ...drag.origin,
            x: Math.min(Math.max(8, drag.origin.x + dx), Math.max(8, maxX)),
            y: Math.min(Math.max(8, drag.origin.y + dy), Math.max(8, maxY)),
          },
          DETACHED_CHAT_MIN_W,
          DETACHED_CHAT_MIN_H
        )
        const snapped = applyMagneticSnap({ rect: next, messagesPanelLeft: panelLeft })
        const isSnapping =
          Math.abs(snapped.x - next.x) > 0.5 || Math.abs(snapped.y - next.y) > 0.5
        setSnapping(isSnapping)
        onRectChange(snapped)
        return
      }

      if (drag.edge) {
        onRectChange(
          resizeFromEdge(drag.origin, drag.edge, dx, dy, DETACHED_CHAT_MIN_W, DETACHED_CHAT_MIN_H)
        )
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      dragRef.current = null
      setSnapping(false)

      if (drag.mode === 'move') {
        const panelLeft = getMessagesPanelLeft()
        const { rect: snapped, docked } = snapRectOnRelease({
          rect: rectRef.current,
          messagesPanelLeft: panelLeft,
        })
        if (docked) {
          onDock()
          return
        }
        onRectChange(snapped)
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [onDock, onRectChange])

  const startMove = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        mode: 'move',
        startX: event.clientX,
        startY: event.clientY,
        origin: rectRef.current,
        pointerId: event.pointerId,
      }
    },
    []
  )

  const startResize = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        mode: 'resize',
        edge,
        startX: event.clientX,
        startY: event.clientY,
        origin: rectRef.current,
        pointerId: event.pointerId,
      }
    },
    []
  )

  return { startMove, startResize, snapping }
}
