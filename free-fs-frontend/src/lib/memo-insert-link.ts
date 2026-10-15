/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { Editor } from '@tiptap/react'
import type { WorkspaceFileDragItem } from '@/components/messages/im-drop-files'

/** 备忘录内可保存的链接 href（含站内路径） */
export function normalizeMemoLinkHref(raw: string): string {
  const url = raw.trim()
  if (!url) return ''
  if (
    /^https?:\/\//i.test(url) ||
    url.startsWith('/') ||
    /^mailto:/i.test(url) ||
    /^tel:/i.test(url)
  ) {
    return url
  }
  return `https://${url}`
}

export function isMemoLinkHrefAllowed(href: string): boolean {
  const v = href.trim()
  if (!v) return false
  if (v.startsWith('/')) return true
  return /^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v)
}

export function workspaceFileMemoHref(
  workspaceSlug: string,
  file: Pick<WorkspaceFileDragItem, 'id' | 'isDir' | 'parentId'>
): string {
  if (file.isDir) {
    return `/w/${workspaceSlug}/files?parentId=${encodeURIComponent(file.id)}`
  }
  const folderId = file.parentId?.trim() || file.id
  return `/w/${workspaceSlug}/files?parentId=${encodeURIComponent(folderId)}`
}

export function insertMemoWorkspaceFileLinks(
  editor: Editor,
  workspaceSlug: string,
  files: WorkspaceFileDragItem[]
) {
  const items = files.filter((f) => f?.id && f.name?.trim())
  if (!items.length) return

  type InlineBit =
    | { type: 'text'; text: string; marks: { type: string; attrs: Record<string, string> }[] }
    | { type: 'hardBreak' }

  const content: InlineBit[] = []
  items.forEach((file, index) => {
    if (index > 0) content.push({ type: 'hardBreak' })
    content.push({
      type: 'text',
      text: file.name.trim(),
      marks: [
        {
          type: 'link',
          attrs: { href: workspaceFileMemoHref(workspaceSlug, file) },
        },
      ],
    })
  })

  editor.chain().focus().insertContent(content).run()
}
