/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { CSSProperties } from 'react'
import type { ResizeEdge } from '@/hooks/use-floating-panel'

type MessagesPopupResizeHandlesProps = {
  onResize: (edge: ResizeEdge) => (event: React.PointerEvent) => void
  /** 为底部输入栏留出可点击区域（像素） */
  reserveBottomPx?: number
}

type EdgeConfig = {
  className: string
  style?: CSSProperties
}

export function MessagesPopupResizeHandles({
  onResize,
  reserveBottomPx = 56,
}: MessagesPopupResizeHandlesProps) {
  const bottom = reserveBottomPx > 0 ? reserveBottomPx : 0
  const sideBottom = reserveBottomPx > 0 ? reserveBottomPx : 8

  const edges: Record<ResizeEdge, EdgeConfig> = {
    n: { className: 'top-0 left-3 right-3 h-2 cursor-ns-resize' },
    s: {
      className: 'left-3 right-3 h-2 cursor-ns-resize',
      style: { bottom },
    },
    e: {
      className: 'top-3 right-0 w-2 cursor-ew-resize',
      style: { bottom: sideBottom },
    },
    w: {
      className: 'top-3 left-0 w-2 cursor-ew-resize',
      style: { bottom: sideBottom },
    },
    ne: { className: 'top-0 right-0 size-4 cursor-nesw-resize' },
    se: {
      className: 'right-0 size-5 cursor-nwse-resize',
      style: { bottom },
    },
    sw: {
      className: 'left-0 size-5 cursor-nesw-resize',
      style: { bottom },
    },
    nw: { className: 'top-0 left-0 size-4 cursor-nesw-resize' },
  }

  return (
    <>
      {(Object.keys(edges) as ResizeEdge[]).map((edge) => (
        <div
          key={edge}
          aria-hidden
          className={`absolute z-40 touch-none ${edges[edge].className}`}
          style={edges[edge].style}
          onPointerDown={onResize(edge)}
        />
      ))}
    </>
  )
}
