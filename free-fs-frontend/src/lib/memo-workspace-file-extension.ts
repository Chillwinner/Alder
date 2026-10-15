/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MemoWorkspaceFileCard } from '@/pages/board/components/memo-workspace-file-card'

export const MemoWorkspaceFile = Node.create({
  name: 'memoWorkspaceFile',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-file-id'),
        renderHTML: (attrs) =>
          attrs.fileId ? { 'data-file-id': attrs.fileId } : {},
      },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') ?? '',
        renderHTML: (attrs) => ({ 'data-name': attrs.name }),
      },
      size: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-size') || 0),
        renderHTML: (attrs) => ({ 'data-size': String(attrs.size ?? 0) }),
      },
      suffix: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-suffix') ?? '',
        renderHTML: (attrs) => ({ 'data-suffix': attrs.suffix ?? '' }),
      },
      isDir: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-is-dir') === 'true',
        renderHTML: (attrs) => ({
          'data-is-dir': attrs.isDir ? 'true' : 'false',
        }),
      },
      mime: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime') ?? '',
        renderHTML: (attrs) => ({ 'data-mime': attrs.mime ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="memo-workspace-file"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'memo-workspace-file' }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MemoWorkspaceFileCard)
  },
})
