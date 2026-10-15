/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { DragEvent } from 'react'
import type { Editor } from '@tiptap/react'
import {
  collectImMessageDrag,
  collectMemoDrag,
  collectWorkspaceFileDrag,
  FREEFS_IM_MESSAGE_MIME,
  FREEFS_MEMOS_MIME,
  FREEFS_WORKSPACE_FILES_MIME,
  isImMessageDrag,
  isMemoDrag,
  isWorkspaceFileDrag,
} from '@/components/messages/im-drop-files'
import { isImageFile, localFilesFromDataTransfer } from '@/lib/memo-insert-image'
import { insertMemoWorkspaceFileEmbeds } from '@/lib/memo-insert-workspace-file'
import { insertMemoWikiLinks } from '@/lib/memo-wiki-link'

export function acceptsMemoEditorDrop(types: DOMStringList | readonly string[]) {
  const list = Array.from(types)
  return (
    list.includes('Files') ||
    list.includes('application/x-moz-file') ||
    list.some((item) => item.startsWith('image/')) ||
    list.includes(FREEFS_WORKSPACE_FILES_MIME) ||
    list.includes(FREEFS_IM_MESSAGE_MIME) ||
    list.includes(FREEFS_MEMOS_MIME)
  )
}

export function applyMemoEditorDrop(
  editor: Editor | null,
  event: DragEvent,
  handlers: {
    currentMemoId?: string
    onImages: (files: File[]) => void
    onLocalFiles?: (files: File[]) => void
    onChatFile: (conversationId: string, messageId: number) => void
    onWorkspaceFail: () => void
    onChatFail: () => void
    onImageInvalid: () => void
    onMemoFail: () => void
  }
) {
  if (isMemoDrag(event)) {
    const memos = collectMemoDrag(event).filter(
      (item) => item.id && item.id !== handlers.currentMemoId
    )
    if (!editor || !memos.length) {
      handlers.onMemoFail()
      return
    }
    insertMemoWikiLinks(editor, memos)
    return
  }
  if (isWorkspaceFileDrag(event)) {
    const { files } = collectWorkspaceFileDrag(event)
    if (!editor || !files.length) {
      handlers.onWorkspaceFail()
      return
    }
    insertMemoWorkspaceFileEmbeds(editor, files)
    return
  }
  if (isImMessageDrag(event)) {
    const item = collectImMessageDrag(event)
    if (!item) {
      handlers.onChatFail()
      return
    }
    handlers.onChatFile(item.conversationId, item.messageId)
    return
  }
  const files = localFilesFromDataTransfer(event.dataTransfer)
  if (!files.length) {
    handlers.onImageInvalid()
    return
  }
  if (handlers.onLocalFiles) {
    handlers.onLocalFiles(files)
    return
  }
  const images = files.filter(isImageFile)
  if (!images.length) {
    handlers.onImageInvalid()
    return
  }
  handlers.onImages(images)
}
