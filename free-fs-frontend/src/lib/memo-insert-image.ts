/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { getCurrentWorkspaceId } from '@/store/workspace'

export function memoImageContentUrl(fileId: string) {
  return `/apis/file/${fileId}/content`
}

/** img 标签带不上请求头，工作空间 id 必须写在 query 里。 */
export function resolveMemoImageSrc(src: string, memoId?: string): string {
  const raw = (src || '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw
  const inline = raw.match(/^alder-inline:(\d+)$/)
  if (inline && memoId) {
    const workspaceId = getCurrentWorkspaceId()
    const url = `/apis/workspace-board/memos/${memoId}/inline-image/${inline[1]}`
    return workspaceId ? `${url}?X-Workspace-Id=${encodeURIComponent(workspaceId)}` : url
  }
  const fileId = parseMemoImageFileId(raw)
  if (!fileId) return raw
  const workspaceId = getCurrentWorkspaceId()
  const url = `/apis/file/${fileId}/content`
  if (!workspaceId) return url
  return `${url}?X-Workspace-Id=${encodeURIComponent(workspaceId)}`
}

const MAX_INLINE_BYTES = 12 * 1024 * 1024

const MEMO_FILE_CONTENT_RE = /\/apis\/file\/([^/?#]+)\/content/

export function parseMemoImageFileId(src: string): string | null {
  const m = src.match(MEMO_FILE_CONTENT_RE)
  return m?.[1] ?? null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export type MemoImageInsertPayload = {
  src: string
  fileId: string | null
}

/** 图片直接写成 md 里的 data URL，不上传、不引用 fileshare。 */
export async function resolveMemoImageInsert(file: File): Promise<MemoImageInsertPayload> {
  if (!isImageFile(file)) {
    throw new Error('not an image')
  }
  if (file.size > MAX_INLINE_BYTES) {
    throw new Error('image too large')
  }
  return { src: await readFileAsDataUrl(file), fileId: null }
}

export function isImageFile(file: File) {
  if (file.type.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i.test(file.name)
}

export function localFilesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return []
  const fromList = [...dt.files]
  if (fromList.length) return fromList
  const out: File[] = []
  for (const item of [...dt.items]) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) out.push(file)
  }
  return out
}

export function imageFilesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  return localFilesFromDataTransfer(dt).filter(isImageFile)
}

export function dropPosFromPointer(
  editor: Editor | null | undefined,
  event: { clientX: number; clientY: number }
): number | undefined {
  if (!editor?.view) return undefined
  const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
  return coords?.pos ?? editor.state.selection.to
}

/** 插在指定位置或当前选区后，避免选中已有图片时 setImage 把上一张换掉 */
export function insertMemoBlockContent(
  editor: Editor,
  content: JSONContent | JSONContent[],
  at?: number
) {
  const { selection } = editor.state
  const pos = at ?? (selection instanceof NodeSelection ? selection.to : selection.to)
  editor.chain().insertContentAt(pos, content).focus().run()
}

export async function memoImagesMarkdownFromFiles(files: Iterable<File>): Promise<string> {
  const list = [...files].filter(isImageFile)
  if (!list.length) return ''
  const parts: string[] = []
  for (const file of list) {
    const { src } = await resolveMemoImageInsert(file)
    parts.push(`![${file.name.replace(/]/g, '')}](${src})`)
  }
  return parts.join('\n\n')
}

export async function insertMemoImagesFromFiles(
  editor: Editor,
  files: Iterable<File>,
  _imageFolderId?: string | null,
  at?: number
): Promise<void> {
  const list = [...files].filter(isImageFile)
  if (!list.length) return
  let nextAt = at
  for (const file of list) {
    const { src, fileId } = await resolveMemoImageInsert(file)
    insertMemoBlockContent(
      editor,
      {
        type: 'image',
        attrs: {
          src,
          alt: file.name,
          fileId,
        },
      },
      nextAt
    )
    nextAt = editor.state.selection.to
  }
}
