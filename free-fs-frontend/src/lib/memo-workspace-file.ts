/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { WorkspaceFileDragItem } from '@/components/messages/im-drop-files'
import type { FileItem } from '@/types/file'

export type MemoWorkspaceFileAttrs = {
  fileId: string
  name: string
  size: number
  suffix: string
  isDir: boolean
  mime: string
}

export function suffixFromFileName(name: string, isDir: boolean): string {
  if (isDir) return ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot >= name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function workspaceDragToMemoFileAttrs(
  item: WorkspaceFileDragItem
): MemoWorkspaceFileAttrs {
  const name = item.name.trim()
  return {
    fileId: item.id,
    name,
    size: item.size ?? 0,
    suffix: suffixFromFileName(name, item.isDir),
    isDir: Boolean(item.isDir),
    mime: item.mime?.trim() || '',
  }
}

export function memoFileAttrsToFileItem(attrs: MemoWorkspaceFileAttrs): FileItem {
  return {
    id: attrs.fileId,
    objectKey: '',
    originalName: attrs.name,
    displayName: attrs.name,
    suffix: attrs.suffix,
    size: attrs.size,
    mimeType: attrs.mime,
    isDir: attrs.isDir,
    userId: '',
    uploadTime: '',
    updateTime: '',
  }
}
