/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { Editor } from '@tiptap/react'
import { getFileContent, uploadFile } from '@/api/file'
import type { WorkspaceFileDragItem } from '@/components/messages/im-drop-files'
import {
  insertMemoBlockContent,
  insertMemoImagesFromFiles,
  isImageFile,
  memoImagesMarkdownFromFiles,
} from '@/lib/memo-insert-image'
import { mdFileCard } from '@/lib/memo-md-edit'
import { workspaceDragToMemoFileAttrs } from '@/lib/memo-workspace-file'
import { isImagePreviewSuffix } from '@/utils/preview'

export function isMemoInsertImage(file: Pick<WorkspaceFileDragItem, 'isDir' | 'mime' | 'name'>) {
  if (file.isDir) return false
  if (file.mime?.toLowerCase().startsWith('image/')) return true
  const name = file.name?.trim() || ''
  const suffix = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : ''
  return isImagePreviewSuffix(suffix)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

async function insertImagesFromWorkspaceFiles(
  editor: Editor,
  files: WorkspaceFileDragItem[],
  at?: number
) {
  let nextAt = at
  for (const file of files) {
    const src = await blobToDataUrl(await getFileContent(file.id))
    insertMemoBlockContent(
      editor,
      {
        type: 'image',
        attrs: {
          src,
          alt: file.name.trim(),
          fileId: null,
        },
      },
      nextAt
    )
    nextAt = editor.state.selection.to
  }
}

function insertFileCards(editor: Editor, files: WorkspaceFileDragItem[], at?: number) {
  if (!files.length) return
  insertMemoBlockContent(
    editor,
    files.map((file) => ({
      type: 'memoWorkspaceFile',
      attrs: workspaceDragToMemoFileAttrs(file),
    })),
    at
  )
}

export async function workspaceFilesToMarkdown(files: WorkspaceFileDragItem[]): Promise<string> {
  const valid = files.filter((f) => f?.id && f.name?.trim())
  if (!valid.length) return ''
  const images = valid.filter(isMemoInsertImage)
  const others = valid.filter((f) => !isMemoInsertImage(f))
  const parts: string[] = []
  for (const file of images) {
    const src = await blobToDataUrl(await getFileContent(file.id))
    parts.push(`![${file.name.trim().replace(/]/g, '')}](${src})`)
  }
  for (const file of others) {
    parts.push(mdFileCard(workspaceDragToMemoFileAttrs(file)))
  }
  return parts.join('\n\n')
}

export async function localFilesToMarkdown(
  files: Iterable<File>,
  fileshareFolderId: string
): Promise<string> {
  const list = [...files].filter((file) => file && file.size >= 0 && file.name)
  if (!list.length) return ''
  const images = list.filter(isImageFile)
  const others = list.filter((file) => !isImageFile(file))
  const parts: string[] = []
  if (images.length) parts.push(await memoImagesMarkdownFromFiles(images))
  if (others.length) {
    const uploaded: WorkspaceFileDragItem[] = []
    for (const file of others) {
      const saved = await uploadFile(file, fileshareFolderId)
      const name = (saved.displayName || saved.originalName || file.name).trim()
      if (!saved.id || !name) continue
      uploaded.push({
        id: saved.id,
        name,
        size: saved.size ?? file.size,
        mime: saved.mimeType || file.type,
        isDir: Boolean(saved.isDir),
        parentId: saved.parentId ?? fileshareFolderId,
      })
    }
    if (!uploaded.length) throw new Error('upload-failed')
    parts.push(await workspaceFilesToMarkdown(uploaded))
  }
  return parts.filter(Boolean).join('\n\n')
}

/** 工作空间文件：不复制。图片写入 md，其它类型只引用。 */
export async function insertMemoWorkspaceFileEmbeds(
  editor: Editor,
  files: WorkspaceFileDragItem[],
  at?: number
) {
  const valid = files.filter((f) => f?.id && f.name?.trim())
  if (!valid.length) return
  const images = valid.filter(isMemoInsertImage)
  const others = valid.filter((f) => !isMemoInsertImage(f))
  if (images.length) await insertImagesFromWorkspaceFiles(editor, images, at)
  if (others.length) insertFileCards(editor, others, editor.state.selection.to)
}

/**
 * 本地文件：图片直接写入 md；其它类型先上传 fileshare 再插入引用卡片。
 */
export async function insertLocalFilesIntoMemo(
  editor: Editor,
  files: Iterable<File>,
  fileshareFolderId: string,
  at?: number
) {
  const list = [...files].filter((file) => file && file.size >= 0 && file.name)
  if (!list.length) return
  const images = list.filter(isImageFile)
  const others = list.filter((file) => !isImageFile(file))
  if (images.length) await insertMemoImagesFromFiles(editor, images, null, at)
  if (!others.length) return
  const uploaded: WorkspaceFileDragItem[] = []
  for (const file of others) {
    const saved = await uploadFile(file, fileshareFolderId)
    const name = (saved.displayName || saved.originalName || file.name).trim()
    if (!saved.id || !name) continue
    uploaded.push({
      id: saved.id,
      name,
      size: saved.size ?? file.size,
      mime: saved.mimeType || file.type,
      isDir: Boolean(saved.isDir),
      parentId: saved.parentId ?? fileshareFolderId,
    })
  }
  if (!uploaded.length) throw new Error('upload-failed')
  insertFileCards(editor, uploaded, editor.state.selection.to)
}
