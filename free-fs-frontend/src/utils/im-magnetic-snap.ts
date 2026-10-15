/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PanelRect } from '@/hooks/use-floating-panel'

export const IM_SNAP_THRESHOLD = 44
export const IM_MAGNETIC_PULL = 0.42

export type MagneticSnapOptions = {
  rect: PanelRect
  messagesPanelLeft?: number | null
}

export function applyMagneticSnap({ rect, messagesPanelLeft }: MagneticSnapOptions): PanelRect {
  let { x, y } = rect
  const rightTarget = window.innerWidth - rect.w - 8

  if (Math.abs(x - rightTarget) <= IM_SNAP_THRESHOLD) {
    x += (rightTarget - x) * IM_MAGNETIC_PULL
  }
  if (x <= IM_SNAP_THRESHOLD) {
    x += (8 - x) * IM_MAGNETIC_PULL
  }
  if (y <= IM_SNAP_THRESHOLD) {
    y += (8 - y) * IM_MAGNETIC_PULL
  }
  const bottomTarget = window.innerHeight - rect.h - 8
  if (Math.abs(y - bottomTarget) <= IM_SNAP_THRESHOLD) {
    y += (bottomTarget - y) * IM_MAGNETIC_PULL
  }

  if (messagesPanelLeft != null) {
    const dockTarget = messagesPanelLeft - rect.w + 12
    if (Math.abs(x - dockTarget) <= IM_SNAP_THRESHOLD * 1.4) {
      x += (dockTarget - x) * (IM_MAGNETIC_PULL + 0.18)
    }
  }

  return { ...rect, x, y }
}

export function snapRectOnRelease({ rect, messagesPanelLeft }: MagneticSnapOptions): {
  rect: PanelRect
  docked: boolean
} {
  if (messagesPanelLeft != null) {
    const dockTarget = messagesPanelLeft - rect.w + 12
    if (Math.abs(x - dockTarget) <= IM_SNAP_THRESHOLD * 1.2) {
      return { rect: { ...rect, x: dockTarget }, docked: true }
    }
  }

  let { x, y } = rect
  const rightTarget = window.innerWidth - rect.w - 8

  if (Math.abs(x - rightTarget) <= IM_SNAP_THRESHOLD) {
    x = rightTarget
  } else if (x <= IM_SNAP_THRESHOLD) {
    x = 8
  }
  if (y <= IM_SNAP_THRESHOLD) {
    y = 8
  }
  const bottomTarget = window.innerHeight - rect.h - 8
  if (Math.abs(y - bottomTarget) <= IM_SNAP_THRESHOLD) {
    y = bottomTarget
  }

  return { rect: { ...rect, x, y }, docked: false }
}

export function getMessagesPanelLeft(): number | null {
  const panel = document.querySelector('[data-im-messages-panel][data-state="open"]')
  if (!panel) return null
  const rect = panel.getBoundingClientRect()
  if (rect.width < 8) return null
  return rect.left
}
