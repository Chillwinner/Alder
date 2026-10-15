/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { JSONContent } from '@tiptap/core'
import { getFileContent, probeWorkspaceFile } from '@/api/file'
import { probeMemo } from '@/api/workspace-board'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { parseMemoImageFileId } from '@/lib/memo-insert-image'
import { stripMemoExportRefs } from '@/lib/memo-md'
import { loadMemoTipTapJson } from '@/lib/memo-preview'
import i18n from '@/i18n'

type Mark = { type: string; attrs?: Record<string, unknown> }
type ImageDataUrls = Map<string, string>

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absUrl(href: string) {
  const raw = href.trim()
  if (!raw) return ''
  if (/^(https?:|data:|mailto:|tel:)/i.test(raw)) return raw
  if (raw.startsWith('/')) {
    if (typeof window !== 'undefined') return `${window.location.origin}${raw}`
  }
  return raw
}

function isWorkspaceFileHref(href: string) {
  return /\/w\/[^/?#]+\/files(?:[/?#]|$)/.test(href.trim())
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

function imageLookupKey(attrs: Record<string, unknown>) {
  const fileId = typeof attrs.fileId === 'string' ? attrs.fileId.trim() : ''
  const src = typeof attrs.src === 'string' ? attrs.src.trim() : ''
  return fileId || src
}

async function resolveImageDataUrl(attrs: Record<string, unknown>) {
  const src = typeof attrs.src === 'string' ? attrs.src.trim() : ''
  if (src.startsWith('data:')) return src
  const fileId =
    (typeof attrs.fileId === 'string' ? attrs.fileId.trim() : '') ||
    parseMemoImageFileId(src) ||
    ''
  try {
    if (fileId) {
      return await blobToDataUrl(await getFileContent(fileId))
    }
    if (!src) return ''
    const res = await fetch(absUrl(src) || src, { credentials: 'include' })
    if (!res.ok) return ''
    return await blobToDataUrl(await res.blob())
  } catch {
    return ''
  }
}

async function collectImageDataUrls(node: JSONContent, cache: ImageDataUrls) {
  if (node.type === 'image') {
    const attrs = node.attrs || {}
    const key = imageLookupKey(attrs)
    if (key && !cache.has(key)) {
      const dataUrl = await resolveImageDataUrl(attrs)
      if (dataUrl) cache.set(key, dataUrl)
    }
  }
  for (const child of node.content ?? []) {
    await collectImageDataUrls(child, cache)
  }
}

async function embedImagesInDoc(doc: JSONContent): Promise<JSONContent> {
  const cache: ImageDataUrls = new Map()
  await collectImageDataUrls(doc, cache)
  const clone = structuredClone(doc) as JSONContent
  const walk = (node: JSONContent) => {
    if (node.type === 'image' && node.attrs) {
      const dataUrl = cache.get(imageLookupKey(node.attrs))
      if (dataUrl) {
        node.attrs = { ...node.attrs, src: dataUrl, fileId: null }
      }
    }
    node.content?.forEach(walk)
  }
  walk(clone)
  return clone
}

function inlineFromMarks(text: string, marks: Mark[] | undefined) {
  const list = marks ?? []
  const link = list.find((m) => m.type === 'link')
  const rawHref = typeof link?.attrs?.href === 'string' ? link.attrs.href : ''
  if (rawHref && isWorkspaceFileHref(rawHref)) return ''
  const href = typeof rawHref === 'string' ? absUrl(rawHref) : ''
  const fontSize = list.find((m) => m.type === 'textStyle')?.attrs?.fontSize
  const size = typeof fontSize === 'string' ? fontSize : ''

  let inner = escapeHtml(text)

  if (list.some((m) => m.type === 'code')) {
    inner = `<code>${inner}</code>`
  }
  if (list.some((m) => m.type === 'bold')) {
    inner = `<strong>${inner}</strong>`
  }
  if (list.some((m) => m.type === 'italic')) {
    inner = `<em>${inner}</em>`
  }
  if (list.some((m) => m.type === 'strike')) {
    inner = `<s>${inner}</s>`
  }
  if (list.some((m) => m.type === 'underline')) {
    inner = `<u>${inner}</u>`
  }
  if (size) {
    inner = `<span style="font-size:${escapeHtml(size)}">${inner}</span>`
  }
  if (href) {
    inner = `<a href="${escapeHtml(href)}">${inner}</a>`
  }
  return inner
}

function serializeInline(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) return ''
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>'
      if (node.type === 'memoWikiLink') {
        const title = String(node.attrs?.title || node.attrs?.memoId || '')
        return escapeHtml(title)
      }
      if (node.type === 'text' && typeof node.text === 'string') {
        return inlineFromMarks(node.text, node.marks as Mark[] | undefined)
      }
      if (node.content) return serializeInline(node.content)
      return ''
    })
    .join('')
}

function alignAttr(align?: unknown) {
  return align === 'center' || align === 'right' ? ` style="text-align:${align}"` : ''
}

function serializeBlock(node: JSONContent, images: ImageDataUrls): string {
  const type = node.type || ''
  const attrs = node.attrs || {}
  const align = attrs.textAlign

  if (type === 'doc') {
    return (node.content ?? []).map((child) => serializeBlock(child, images)).join('')
  }

  if (type === 'paragraph') {
    const inline = serializeInline(node.content)
    if (!inline.trim()) return ''
    return `<p${alignAttr(align)}>${inline}</p>\n`
  }

  if (type === 'heading') {
    const level = Math.min(6, Math.max(1, Number(attrs.level) || 1))
    const inline = serializeInline(node.content)
    return `<h${level}${alignAttr(align)}>${inline}</h${level}>\n`
  }

  if (type === 'blockquote') {
    const inner = (node.content ?? []).map((child) => serializeBlock(child, images)).join('')
    return `<blockquote>\n${inner}</blockquote>\n`
  }

  if (type === 'codeBlock') {
    const text = (node.content ?? [])
      .map((child) => (typeof child.text === 'string' ? child.text : serializeInline(child.content)))
      .join('')
    return `<pre><code>${escapeHtml(text)}</code></pre>\n`
  }

  if (type === 'horizontalRule') return '<hr />\n'

  if (type === 'bulletList') {
    const items = (node.content ?? []).map((item) => serializeListItem(item, images)).join('')
    return `<ul>\n${items}</ul>\n`
  }

  if (type === 'orderedList') {
    const start = Number(attrs.start) || 1
    const startAttr = start > 1 ? ` start="${start}"` : ''
    const items = (node.content ?? []).map((item) => serializeListItem(item, images)).join('')
    return `<ol${startAttr}>\n${items}</ol>\n`
  }

  if (type === 'listItem') {
    return serializeListItem(node, images)
  }

  if (type === 'image') {
    const dataUrl = images.get(imageLookupKey(attrs)) || ''
    if (!dataUrl.startsWith('data:')) return ''
    const alt = escapeHtml(String(attrs.alt || attrs.title || ''))
    const width = typeof attrs.width === 'number' ? attrs.width : Number(attrs.width)
    const imgAlign = attrs.align === 'center' || attrs.align === 'right' ? attrs.align : ''
    const style = [
      'max-width:100%',
      'height:auto',
      Number.isFinite(width) && width > 0 ? `width:${width}px` : '',
      imgAlign === 'center' ? 'display:block;margin-left:auto;margin-right:auto' : '',
      imgAlign === 'right' ? 'display:block;margin-left:auto' : '',
    ]
      .filter(Boolean)
      .join(';')
    return `<p${imgAlign ? ` style="text-align:${imgAlign}"` : ''}><img src="${dataUrl}" alt="${alt}" style="${style}" /></p>\n`
  }

  if (type === 'memoWorkspaceFile') {
    return ''
  }

  if (node.content) {
    return node.content.map((child) => serializeBlock(child, images)).join('')
  }
  return ''
}

function serializeListItem(node: JSONContent, images: ImageDataUrls) {
  const inner = (node.content ?? [])
    .map((child) => {
      if (child.type === 'paragraph') {
        const inline = serializeInline(child.content)
        return inline ? `<p${alignAttr(child.attrs?.textAlign)}>${inline}</p>` : ''
      }
      return serializeBlock(child, images)
    })
    .join('')
  if (!inner.trim()) return ''
  return `<li>${inner}</li>\n`
}

export async function memoJsonToMarkdown(doc: JSONContent, title?: string) {
  const images: ImageDataUrls = new Map()
  await collectImageDataUrls(doc, images)
  const body = serializeBlock(doc, images).trim()
  const heading = title?.trim() ? `<h1>${escapeHtml(title.trim())}</h1>\n` : ''
  return `${heading}${body}\n`
}

export function memoMarkdownFileName(title?: string) {
  const base = (title?.trim() || 'memo').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  return `${base}.md`
}

export type MemoExportMode = 'workspace' | 'chat' | 'local'

function collectMemoRefs(node: JSONContent, memos: Set<string>, files: Set<string>) {
  if (node.type === 'memoWikiLink') {
    const id = String(node.attrs?.memoId || '').trim()
    if (id) memos.add(id)
  }
  if (node.type === 'memoWorkspaceFile') {
    const id = String(node.attrs?.fileId || '').trim()
    if (id) files.add(id)
  }
  node.content?.forEach((child) => collectMemoRefs(child, memos, files))
}

function fileExportName(name: string, fileId: string) {
  const raw = (name || fileId).replace(/[\\/:*?"<>|]/g, '_').trim() || fileId
  return raw.slice(0, 80)
}

function rewriteExportRefs(
  node: JSONContent,
  mode: MemoExportMode,
  memoOk: Map<string, boolean>,
  fileOk: Map<string, boolean>
) {
  if (!node.content) return
  node.content = node.content.flatMap((child) => {
    rewriteExportRefs(child, mode, memoOk, fileOk)
    if (child.type === 'memoWikiLink') {
      const id = String(child.attrs?.memoId || '')
      const title = String(child.attrs?.title || id)
      const ok = memoOk.get(id) !== false
      if (!ok) {
        return [{ type: 'text', text: `${title}${i18n.t('editor.refMemoGone', { ns: 'board' })}` }]
      }
      if (mode === 'workspace') return [child]
      return [{ type: 'text', text: `${title}${i18n.t('editor.refMemoExport', { ns: 'board' })}` }]
    }
    if (child.type === 'memoWorkspaceFile') {
      const id = String(child.attrs?.fileId || '')
      const name = String(child.attrs?.name || id)
      const ok = fileOk.get(id) !== false
      if (!ok) {
        return [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `${name}${i18n.t('editor.refFileGone', { ns: 'board' })}` }],
          },
        ]
      }
      if (mode === 'workspace') return [child]
      const suffix =
        mode === 'chat'
          ? i18n.t('editor.refFileAttached', { ns: 'board' })
          : i18n.t('editor.refFileExport', { ns: 'board' })
      return [{ type: 'paragraph', content: [{ type: 'text', text: `${name}${suffix}` }] }]
    }
    return [child]
  })
}

export async function packageMemoExport(memo: WorkspaceMemo, mode: MemoExportMode) {
  if (memo.kind === 'canvas') {
    const { packageMemoCanvasExport } = await import('@/lib/memo-canvas-export')
    return packageMemoCanvasExport(memo, mode === 'chat' ? 'chat' : 'local')
  }
  const { getMemoBody } = await import('@/api/workspace-board')
  const body = await getMemoBody(memo.id)
  const markdown = stripMemoExportRefs(body.bodyMd ?? '')
  const file = new File([markdown], memoMarkdownFileName(memo.title), {
    type: 'text/markdown;charset=utf-8',
  })
  return { file, attachments: [] as File[] }
}

export async function memoMarkdownAsFile(memo: WorkspaceMemo) {
  const { file } = await packageMemoExport(memo, 'local')
  return file
}

export async function exportMemoAsMarkdown(memo: WorkspaceMemo) {
  if (memo.kind === 'canvas') {
    const { exportMemoCanvas } = await import('@/lib/memo-canvas-export')
    await exportMemoCanvas(memo)
    return
  }
  const { file } = await packageMemoExport(memo, 'local')
  downloadMarkdownFile(file.name, await file.text())
}

export function downloadMarkdownFile(filename: string, markdown: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
