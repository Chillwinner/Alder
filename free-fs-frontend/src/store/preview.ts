/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import type { FileItem } from '@/types/file'

export type PreviewOriginRect = {
  left: number
  top: number
  width: number
  height: number
}

export type PreviewOpenOptions = {
  navigationFiles?: FileItem[]
  shareId?: string
  /** 聊天附件等：直接用静态/相对路径取内容，不走网盘 fileId */
  sourceUrl?: string
  origin?: PreviewOriginRect | DOMRect | null
  /** 预览内部切上一张/下一张，不受关闭冷却限制 */
  force?: boolean
}

type PreviewState = {
  file: FileItem | null
  navigationFiles: FileItem[]
  shareId?: string
  sourceUrl?: string
  origin: PreviewOriginRect | null
  open: (file: FileItem, options?: PreviewOpenOptions) => void
  close: () => void
  /** 关闭动画期间挡住卡片二次打开 */
  blockReopen: () => void
}

let suppressOpenUntil = 0

export const usePreviewStore = create<PreviewState>((set) => ({
  file: null,
  navigationFiles: [],
  shareId: undefined,
  sourceUrl: undefined,
  origin: null,
  open: (file, options) => {
    if (!options?.force && Date.now() < suppressOpenUntil) {
      return
    }
    set((state) => ({
      file,
      navigationFiles: options?.navigationFiles ?? [],
      shareId: options?.shareId,
      sourceUrl: options?.sourceUrl,
      origin:
        options?.origin !== undefined
          ? copyOrigin(options.origin)
          : state.file
            ? state.origin
            : null,
    }))
  },
  blockReopen: () => {
    suppressOpenUntil = Date.now() + 700
  },
  close: () => {
    suppressOpenUntil = Date.now() + 700
    set({
      file: null,
      navigationFiles: [],
      shareId: undefined,
      sourceUrl: undefined,
      origin: null,
    })
  },
}))

function copyOrigin(origin?: PreviewOriginRect | DOMRect | null): PreviewOriginRect | null {
  if (!origin) return null
  return {
    left: origin.left,
    top: origin.top,
    width: origin.width,
    height: origin.height,
  }
}
