/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PanelRect } from '@/hooks/use-floating-panel'

export const DETACHED_CHAT_WIDTH = 380
export const DETACHED_CHAT_HEIGHT = 520
export const DETACHED_CHAT_MIN_W = 320
export const DETACHED_CHAT_MIN_H = 400

export function createDetachedChatRect(anchor?: { x: number; y: number }, stackIndex = 0): PanelRect {
  const w = Math.min(DETACHED_CHAT_WIDTH, window.innerWidth - 24)
  const h = Math.min(DETACHED_CHAT_HEIGHT, window.innerHeight - 24)
  const stackOffset = stackIndex * 28

  if (anchor) {
    const x = Math.min(
      Math.max(8, anchor.x - w / 2),
      window.innerWidth - w - 8
    )
    const y = Math.min(
      Math.max(8, anchor.y - 24),
      window.innerHeight - h - 8
    )
    return { x, y, w, h }
  }

  const x = Math.max(8, window.innerWidth - w - 16 - stackOffset)
  const y = Math.max(8, window.innerHeight - h - 16 - stackOffset)
  return { x, y, w, h }
}
