/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { Editor, NodeViewProps } from '@tiptap/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { lookupMemoByName, probeMemo } from '@/api/workspace-board'
import { useMemoPreviewStore } from '@/store/memo-preview'
import type { WorkspaceMemo } from '@/types/workspace-board'

export const OPEN_MEMO_EVENT = 'alder:open-memo'
export const INSERT_MEMO_LINKS_EVENT = 'alder:insert-memo-links'

export function openMemoById(memoId: string, title?: string) {
  if (!memoId) return
  useMemoPreviewStore.getState().open(
    {
      id: memoId,
      workspaceId: '',
      title: (title || '').trim(),
    },
    null
  )
}

export function insertMemoWikiLinks(editor: Editor, memos: WorkspaceMemo[], at?: number) {
  const nodes = memos
    .filter((item) => item?.id)
    .map((item) => ({
      type: 'memoWikiLink',
      attrs: {
        memoId: item.id,
        title: item.title?.trim() || '',
      },
    }))
  if (!nodes.length) return
  const content = nodes.flatMap((node, index) =>
    index === 0 ? [node] : [{ type: 'text', text: ' ' }, node]
  )
  const pos = at ?? editor.state.selection.to
  editor.chain().focus().insertContentAt(pos, content).run()
}

export function requestInsertMemoLinks(targetMemoId: string, memos: WorkspaceMemo[]) {
  const detail = { targetMemoId, memos, handled: false }
  window.dispatchEvent(new CustomEvent(INSERT_MEMO_LINKS_EVENT, { detail }))
  return detail
}

function WikiChip({ node }: NodeViewProps) {
  const { t } = useTranslation('board')
  const memoId = String(node?.attrs?.memoId ?? '')
  const title = String(node?.attrs?.title ?? '')
  const label = title.trim() || t('editor.refMemoFallback')
  const resolve = useQuery({
    queryKey: ['memo-wiki', memoId, title],
    enabled: Boolean(memoId || title.trim()),
    queryFn: async () => {
      if (memoId) {
        await probeMemo(memoId)
        return memoId
      }
      const found = await lookupMemoByName(title.trim())
      return found.id
    },
    staleTime: 30_000,
    retry: false,
  })
  const targetId = memoId || resolve.data || ''
  const gone = resolve.isError
  return (
    <NodeViewWrapper as='span' className='memo-wiki-wrap'>
      <button
        type='button'
        className={gone ? 'memo-wiki-chip memo-wiki-chip--gone' : 'memo-wiki-chip'}
        title={gone ? t('editor.memoLinkMissing') : label}
        disabled={gone || resolve.isLoading}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!targetId || gone) return
          openMemoById(targetId, label)
        }}
      >
        <span className='truncate'>{gone ? `${label}${t('editor.refMemoGone')}` : label}</span>
      </button>
    </NodeViewWrapper>
  )
}

export const MemoWikiLink = Node.create({
  name: 'memoWikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      memoId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-memo-id') || '',
        renderHTML: (attrs) => (attrs.memoId ? { 'data-memo-id': attrs.memoId } : {}),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || el.textContent || '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title || '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="memo-wiki"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'memo-wiki' }),
      node.attrs.title || node.attrs.memoId,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiChip)
  },
})
