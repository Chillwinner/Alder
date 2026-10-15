/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type * as Y from 'yjs'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MemoEditorImageView } from '@/pages/board/components/memo-editor-image-view'
import { memoImageContentUrl, parseMemoImageFileId } from '@/lib/memo-insert-image'
import { MemoWorkspaceFile } from '@/lib/memo-workspace-file-extension'
import { MemoWikiLink } from '@/lib/memo-wiki-link'
import { MemoMarkdownApply } from '@/lib/memo-md-apply'

const MemoImage = Image.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      src: {
        ...parent.src,
        parseHTML: (element) => {
          const src = element.getAttribute('src')
          if (src) return src
          const fileId = element.getAttribute('data-file-id')
          return fileId ? memoImageContentUrl(fileId) : null
        },
        renderHTML: (attributes) => {
          const src =
            attributes.src ||
            (attributes.fileId ? memoImageContentUrl(attributes.fileId) : '')
          return src ? { src } : {}
        },
      },
      fileId: {
        default: null as string | null,
        parseHTML: (element) =>
          element.getAttribute('data-file-id') ||
          parseMemoImageFileId(element.getAttribute('src') || ''),
        renderHTML: (attributes) => {
          if (!attributes.fileId) return {}
          return { 'data-file-id': attributes.fileId }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(MemoEditorImageView)
  },
  addProseMirrorPlugins() {
    return []
  },
})

export function buildMemoEditorExtensions(document?: Y.Doc | null) {
  return [
    StarterKit.configure({
      history: !document,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    MemoMarkdownApply,
    ...(document ? [Collaboration.configure({ document })] : []),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      validate: (href) => {
        const v = href.trim()
        if (v.startsWith('/')) return true
        return (
          /^https?:\/\//i.test(v) ||
          /^mailto:/i.test(v) ||
          /^tel:/i.test(v)
        )
      },
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2',
      },
    }),
    MemoImage.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        class: 'max-w-full rounded-md my-2',
      },
    }),
    MemoWorkspaceFile,
    MemoWikiLink,
  ]
}
