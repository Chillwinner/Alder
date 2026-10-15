/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { MemoWorkspaceFileAttrs } from '@/lib/memo-workspace-file'

export function replaceTextareaRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  insert: string,
  onChange: (value: string) => void,
  select: { start: number; end: number }
) {
  const next = el.value.slice(0, start) + insert + el.value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(select.start, select.end)
  })
}

export function wrapSelection(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  onChange: (value: string) => void
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = el.value.slice(start, end)
  replaceTextareaRange(el, start, end, `${before}${selected}${after}`, onChange, {
    start: start + before.length,
    end: start + before.length + selected.length,
  })
}

export function prefixSelectedLines(
  el: HTMLTextAreaElement,
  prefix: string,
  onChange: (value: string) => void
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = el.value
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const block = value.slice(lineStart, end)
  const nextBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join('\n')
  replaceTextareaRange(el, lineStart, end, nextBlock, onChange, {
    start: lineStart,
    end: lineStart + nextBlock.length,
  })
}

export function insertSnippet(
  el: HTMLTextAreaElement,
  snippet: string,
  onChange: (value: string) => void
) {
  const start = el.selectionStart
  const end = el.selectionEnd
  const padStart = start > 0 && el.value[start - 1] !== '\n' ? '\n' : ''
  const padEnd = el.value[end] && el.value[end] !== '\n' ? '\n' : ''
  const text = `${padStart}${snippet}${padEnd}`
  replaceTextareaRange(el, start, end, text, onChange, {
    start: start + text.length,
    end: start + text.length,
  })
}

export function mdImage(alt: string, src: string) {
  return `![${alt.replace(/]/g, '')}](${src})`
}

export function mdWikiLink(title: string) {
  const name = title.replace(/\]/g, '').trim()
  return `[[${name}]]`
}

export function mdFileCard(attrs: MemoWorkspaceFileAttrs) {
  const name = attrs.name.replace(/"/g, '')
  const suffix = (attrs.suffix || '').replace(/"/g, '')
  const mime = (attrs.mime || '').replace(/"/g, '')
  return `:::file id="${attrs.fileId}" name="${name}" suffix="${suffix}" size="${attrs.size || 0}" mime="${mime}" dir="${attrs.isDir ? 'true' : 'false'}"\n:::`
}
