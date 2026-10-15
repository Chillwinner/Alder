/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type PanelRect = {
  x: number
  y: number
  w: number
  h: number
}

export type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'

type FloatingPanelOptions = {
  minW?: number
  minH?: number
  /** localStorage key — restores last position/size; first open uses createRect() */
  persistKey?: string
}

type DragState = {
  mode: 'move' | 'resize'
  edge?: ResizeEdge
  startX: number
  startY: number
  origin: PanelRect
  pointerId: number
}

const DEFAULT_MIN_W = 520
const DEFAULT_MIN_H = 360

export function createDefaultRect(): PanelRect {
  const w = Math.min(Math.round(window.innerWidth * 0.88), 1440)
  const h = Math.min(Math.round(window.innerHeight * 0.8), 920)
  const x = Math.round((window.innerWidth - w) / 2)
  const y = Math.max(24, Math.round(window.innerHeight * 0.06))
  return { x, y, w, h }
}

export function createBottomRightRect(width = 920, height = 640): PanelRect {
  const w = Math.min(width, window.innerWidth - 16)
  const h = Math.min(height, window.innerHeight - 16)
  const x = Math.max(8, window.innerWidth - w - 16)
  const y = Math.max(8, window.innerHeight - h - 16)
  return { x, y, w, h }
}

export function createCenteredRect(width = 880, height = 680): PanelRect {
  const w = Math.min(width, Math.max(320, window.innerWidth - 16))
  const h = Math.min(height, Math.max(240, window.innerHeight - 16))
  const x = Math.round((window.innerWidth - w) / 2)
  const y = Math.max(8, Math.round((window.innerHeight - h) / 2))
  return { x, y, w, h }
}

function isPanelRect(value: unknown): value is PanelRect {
  if (!value || typeof value !== 'object') return false
  const r = value as PanelRect
  return [r.x, r.y, r.w, r.h].every(
    (n) => typeof n === 'number' && Number.isFinite(n) && n > 0
  )
}

function readPersistedRect(
  key: string,
  minW: number,
  minH: number,
  createRect: () => PanelRect
): PanelRect {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isPanelRect(parsed)) {
        return clampRect(parsed, minW, minH)
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return clampRect(createRect(), minW, minH)
}

function writePersistedRect(key: string, rect: PanelRect) {
  try {
    localStorage.setItem(key, JSON.stringify(rect))
  } catch {
    // quota / private mode
  }
}

export function clampRect(rect: PanelRect, minW: number, minH: number): PanelRect {
  const maxW = window.innerWidth - rect.x - 8
  const maxH = window.innerHeight - rect.y - 8
  const w = Math.min(Math.max(minW, rect.w), Math.max(minW, maxW))
  const h = Math.min(Math.max(minH, rect.h), Math.max(minH, maxH))
  const maxX = window.innerWidth - w - 8
  const maxY = window.innerHeight - h - 8
  return {
    w,
    h,
    x: Math.min(Math.max(8, rect.x), Math.max(8, maxX)),
    y: Math.min(Math.max(8, rect.y), Math.max(8, maxY)),
  }
}

function resizeFromEdge(origin: PanelRect, edge: ResizeEdge, dx: number, dy: number, minW: number, minH: number): PanelRect {
  let { x, y, w, h } = origin

  if (edge.includes('e')) {
    w = origin.w + dx
  }
  if (edge.includes('w')) {
    w = origin.w - dx
    x = origin.x + dx
  }
  if (edge.includes('s')) {
    h = origin.h + dy
  }
  if (edge.includes('n')) {
    h = origin.h - dy
    y = origin.y + dy
  }

  if (w < minW) {
    if (edge.includes('w')) {
      x -= minW - w
    }
    w = minW
  }
  if (h < minH) {
    if (edge.includes('n')) {
      y -= minH - h
    }
    h = minH
  }

  return clampRect({ x, y, w, h }, minW, minH)
}

export function useFloatingPanel(
  open: boolean,
  createRect: () => PanelRect = createDefaultRect,
  options: FloatingPanelOptions = {}
) {
  const minW = options.minW ?? DEFAULT_MIN_W
  const minH = options.minH ?? DEFAULT_MIN_H
  const persistKey = options.persistKey
  const [rect, setRectState] = useState<PanelRect>(() =>
    persistKey
      ? readPersistedRect(persistKey, minW, minH, createRect)
      : clampRect(createRect(), minW, minH)
  )
  const [expanded, setExpanded] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const rectRef = useRef(rect)
  rectRef.current = rect
  const nodeRef = useRef<HTMLElement | null>(null)
  const createRectRef = useRef(createRect)
  createRectRef.current = createRect
  const frameRef = useRef(0)

  const paint = useCallback((next: PanelRect) => {
    const el = nodeRef.current
    if (!el) return
    el.style.left = `${next.x}px`
    el.style.top = `${next.y}px`
    el.style.width = `${next.w}px`
    el.style.height = `${next.h}px`
    el.style.transform = 'none'
  }, [])

  const setRect = useCallback(
    (value: PanelRect | ((prev: PanelRect) => PanelRect)) => {
      setRectState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        const clamped = clampRect(next, minW, minH)
        rectRef.current = clamped
        paint(clamped)
        return clamped
      })
    },
    [minH, minW, paint]
  )

  const bindPanel = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
    if (node && !expanded) paint(rectRef.current)
  }, [expanded, paint])

  const persistRect = useCallback(() => {
    if (!persistKey) return
    writePersistedRect(persistKey, clampRect(rectRef.current, minW, minH))
  }, [minH, minW, persistKey])

  useEffect(() => {
    if (open) {
      if (persistKey) {
        setRect(readPersistedRect(persistKey, minW, minH, createRectRef.current))
      }
      return
    }
    setExpanded(false)
    if (persistKey) {
      persistRect()
    } else {
      setRect(createRectRef.current())
    }
  }, [minH, minW, open, persistKey, persistRect, setRect])

  useEffect(() => {
    const onResize = () => {
      if (expanded) return
      setRect((current) => clampRect(current, minW, minH))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [expanded, minH, minW, setRect])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY

      const next =
        drag.mode === 'move'
          ? clampRect(
              {
                ...drag.origin,
                x: Math.min(
                  Math.max(8, drag.origin.x + dx),
                  Math.max(8, window.innerWidth - drag.origin.w - 8)
                ),
                y: Math.min(
                  Math.max(8, drag.origin.y + dy),
                  Math.max(8, window.innerHeight - drag.origin.h - 8)
                ),
              },
              minW,
              minH
            )
          : drag.edge
            ? resizeFromEdge(drag.origin, drag.edge, dx, dy, minW, minH)
            : null
      if (!next) return
      rectRef.current = next
      paint(next)
    }

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      dragRef.current = null
      cancelAnimationFrame(frameRef.current)
      const settled = clampRect(rectRef.current, minW, minH)
      setRect(settled)
      if (persistKey) {
        writePersistedRect(persistKey, settled)
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
  }, [minH, minW, paint, persistKey, setRect])

  const startMove = useCallback(
    (event: React.PointerEvent) => {
      if (expanded) return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('button, a, input, textarea, select, [role="slider"]')
      ) {
        return
      }
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
    [expanded]
  )

  const startResize = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent) => {
      if (expanded) return
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
    [expanded]
  )

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => !value)
  }, [])

  return {
    rect,
    expanded,
    bindPanel,
    startMove,
    startResize,
    toggleExpanded,
  }
}
