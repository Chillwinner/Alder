/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

function wrapPrefix(
  newState: import('@tiptap/pm/state').EditorState,
  start: number,
  prefixLen: number,
  wrapper: { type: import('@tiptap/pm/model').NodeType; attrs?: Record<string, unknown> }
) {
  const tr = newState.tr.setMeta('memoMd', true).delete(start, start + prefixLen)
  const $pos = tr.doc.resolve(tr.mapping.map(start))
  const range = $pos.blockRange()
  if (!range) return null
  return tr.wrap(range, [wrapper])
}

export const MemoMarkdownApply = Extension.create({
  name: 'memoMarkdownApply',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('memoMarkdownApply'),
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((tr) => tr.docChanged && !tr.getMeta('memoMd'))) {
            return null
          }
          const { $from } = state.selection
          if (!$from.parent.isTextblock) return null
          const parent = $from.parent
          if (parent.type.name !== 'paragraph') return null
          const text = parent.textContent
          const start = $from.start()
          const nodes = state.schema.nodes
          const marks = state.schema.marks

          const heading = text.match(/^(#{1,6}) $/)
          if (heading && nodes.heading) {
            return state.tr
              .setMeta('memoMd', true)
              .delete(start, start + heading[0].length)
              .setBlockType(start, start, nodes.heading, { level: heading[1].length })
          }

          if (/^[-*] $/.test(text) && nodes.bulletList) {
            return wrapPrefix(state, start, 2, { type: nodes.bulletList })
          }

          const ordered = text.match(/^(\d+)\. $/)
          if (ordered && nodes.orderedList) {
            return wrapPrefix(state, start, ordered[0].length, {
              type: nodes.orderedList,
              attrs: { start: Number(ordered[1]) },
            })
          }

          if (/^> $/.test(text) && nodes.blockquote) {
            return wrapPrefix(state, start, 2, { type: nodes.blockquote })
          }

          const bold = text.match(/\*\*([^*]+)\*\*$/)
          if (bold && marks.bold) {
            const from = start + text.length - bold[0].length
            const to = start + text.length
            return state.tr
              .setMeta('memoMd', true)
              .delete(from, to)
              .insert(from, state.schema.text(bold[1], [marks.bold.create()]))
          }

          const italic = text.match(/(^|[^*])\*([^*]+)\*$/)
          if (italic && marks.italic && !text.endsWith('**')) {
            const token = `*${italic[2]}*`
            const from = start + text.length - token.length
            const to = start + text.length
            return state.tr
              .setMeta('memoMd', true)
              .delete(from, to)
              .insert(from, state.schema.text(italic[2], [marks.italic.create()]))
          }

          const strike = text.match(/~~([^~]+)~~$/)
          if (strike && marks.strike) {
            const from = start + text.length - strike[0].length
            const to = start + text.length
            return state.tr
              .setMeta('memoMd', true)
              .delete(from, to)
              .insert(from, state.schema.text(strike[1], [marks.strike.create()]))
          }

          const code = text.match(/`([^`]+)`$/)
          if (code && marks.code) {
            const from = start + text.length - code[0].length
            const to = start + text.length
            return state.tr
              .setMeta('memoMd', true)
              .delete(from, to)
              .insert(from, state.schema.text(code[1], [marks.code.create()]))
          }

          return null
        },
      }),
    ]
  },
})
