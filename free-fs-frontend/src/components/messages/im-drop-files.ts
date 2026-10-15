/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { DragEvent as ReactDragEvent } from 'react'
import type { FileItem } from '@/types/file'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { IM_MSG_FILE, IM_MSG_IMAGE } from '@/utils/im-message-content'

type DragLike = DragEvent | ReactDragEvent

export const FREEFS_WORKSPACE_FILES_MIME = 'application/x-freefs-workspace-files'
export const FREEFS_IM_MESSAGE_MIME = 'application/x-freefs-im-message'
export const FREEFS_MEMOS_MIME = 'application/x-freefs-memos'

export type ImMessageDragItem = {
  conversationId: string
  messageId: number
}

export type WorkspaceFileDragItem = {
  id: string
  name: string
  size: number
  mime?: string | null
  isDir: boolean
  parentId?: string | null
}

export function isExternalFileDrag(event: DragLike) {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

export function isWorkspaceFileDrag(event: DragLike) {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes(FREEFS_WORKSPACE_FILES_MIME)
}

let memoDragCache: WorkspaceMemo[] = []

export function rememberMemoDrag(memos: WorkspaceMemo[]) {
  memoDragCache = memos.filter((item) => item?.id)
}

export function peekMemoDragCache() {
  return memoDragCache
}

export function clearMemoDragCache() {
  memoDragCache = []
}

export function isMemoDrag(event: DragLike) {
  const types = event.dataTransfer?.types
  if (!types) return memoDragCache.length > 0
  const list = Array.from(types)
  if (list.includes(FREEFS_MEMOS_MIME)) return true
  return memoDragCache.length > 0 && list.includes('text/plain')
}

export function isImDroppableDrag(event: DragLike) {
  return isExternalFileDrag(event) || isWorkspaceFileDrag(event) || isMemoDrag(event)
}

export function isImMessageDrag(event: DragLike) {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes(FREEFS_IM_MESSAGE_MIME)
}

export function setImMessageDragData(transfer: DataTransfer, item: ImMessageDragItem) {
  transfer.effectAllowed = 'copy'
  transfer.setData(FREEFS_IM_MESSAGE_MIME, JSON.stringify(item))
  transfer.setData('text/plain', String(item.messageId))
}

export function collectImMessageDrag(event: DragLike): ImMessageDragItem | null {
  const raw = event.dataTransfer?.getData(FREEFS_IM_MESSAGE_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ImMessageDragItem
    if (!parsed?.conversationId || !parsed.messageId) return null
    return parsed
  } catch {
    return null
  }
}

export function toWorkspaceFileDragItem(file: FileItem): WorkspaceFileDragItem {
  return {
    id: file.id,
    name: file.displayName || file.originalName,
    size: file.size ?? 0,
    mime: file.mimeType,
    isDir: Boolean(file.isDir),
    parentId: file.parentId ?? null,
  }
}

export function setMemoDragData(transfer: DataTransfer, memos: WorkspaceMemo[]) {
  rememberMemoDrag(memos)
  transfer.effectAllowed = 'copy'
  transfer.setData(FREEFS_MEMOS_MIME, JSON.stringify(memos))
  const slim = memos.map((item) => ({ id: item.id, title: item.title || '' }))
  transfer.setData('text/plain', `freefs-memo:${JSON.stringify(slim)}`)
}

export function collectMemoDrag(event: DragLike): WorkspaceMemo[] {
  const raw = event.dataTransfer?.getData(FREEFS_MEMOS_MIME)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as WorkspaceMemo[]
      const memos = parsed.filter((item) => item?.id)
      if (memos.length) return memos
    } catch {
      /* fallback */
    }
  }
  const plain = event.dataTransfer?.getData('text/plain') || ''
  if (plain.startsWith('freefs-memo:')) {
    try {
      const parsed = JSON.parse(plain.slice('freefs-memo:'.length)) as WorkspaceMemo[]
      const memos = parsed.filter((item) => item?.id)
      if (memos.length) return memos
    } catch {
      /* fallback */
    }
  }
  return memoDragCache.filter((item) => item?.id)
}

export function setWorkspaceFileDragData(
  transfer: DataTransfer,
  files: FileItem[],
  options?: { effectAllowed?: DataTransfer['effectAllowed'] }
) {
  const payload = files.map(toWorkspaceFileDragItem)
  transfer.effectAllowed = options?.effectAllowed ?? 'copy'
  transfer.setData(FREEFS_WORKSPACE_FILES_MIME, JSON.stringify(payload))
  transfer.setData('text/plain', payload.map((item) => item.name).join(', '))
}

export function collectWorkspaceFileDrag(event: DragLike) {
  const files: WorkspaceFileDragItem[] = []
  const skippedFolders: string[] = []
  const raw = event.dataTransfer?.getData(FREEFS_WORKSPACE_FILES_MIME)
  if (!raw) return { files, skippedFolders }
  try {
    const parsed = JSON.parse(raw) as WorkspaceFileDragItem[]
    for (const item of parsed) {
      if (!item?.id) continue
      files.push(item)
    }
  } catch {
    // ignore malformed payload
  }
  return { files, skippedFolders }
}

export function imMsgTypeForFile(file: File) {
  return file.type.startsWith('image/') ? IM_MSG_IMAGE : IM_MSG_FILE
}

export function collectDroppedFiles(event: DragLike) {
  const transfer = event.dataTransfer
  const files: File[] = []
  const skippedFolders: string[] = []
  if (!transfer) return { files, skippedFolders }

  const items = transfer.items
  if (items && items.length > 0) {
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') continue
      const entry = item.webkitGetAsEntry?.()
      if (entry?.isDirectory) {
        skippedFolders.push(entry.name)
        continue
      }
      const file = item.getAsFile()
      if (!file) continue
      if (file.size <= 0) {
        skippedFolders.push(file.name)
        continue
      }
      files.push(file)
    }
    return { files, skippedFolders }
  }

  for (const file of Array.from(transfer.files ?? [])) {
    if (file.size <= 0) {
      skippedFolders.push(file.name)
      continue
    }
    files.push(file)
  }
  return { files, skippedFolders }
}
