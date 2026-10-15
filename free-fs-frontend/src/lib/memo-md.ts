/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { JSONContent } from '@tiptap/core'
import { memoImageContentUrl, parseMemoImageFileId } from '@/lib/memo-insert-image'
import { resolveShieldedImageSrc, shieldDataImagesInMarkdown } from '@/lib/md-data-images'

export const MEMO_WIKI_RE = /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g
export const MEMO_FILE_FENCE_RE =
  /^:::file\s+id="([^"]+)"(?:\s+name="([^"]*)")?(?:\s+suffix="([^"]*)")?(?:\s+size="([^"]*)")?(?:\s+mime="([^"]*)")?(?:\s+dir="([^"]*)")?\s*$/

export type MemoPreviewSegment =
  | { type: 'md'; text: string }
  | {
      type: 'file'
      attrs: {
        fileId: string
        name: string
        suffix: string
        size: number
        mime: string
        isDir: boolean
      }
    }

export function splitMemoPreviewSegments(source: string): MemoPreviewSegment[] {
  const lines = (source || '').replace(/\r\n/g, '\n').split('\n')
  const segs: MemoPreviewSegment[] = []
  const buf: string[] = []
  const flushMd = () => {
    const text = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    buf.length = 0
    if (text) segs.push({ type: 'md', text })
  }
  let i = 0
  while (i < lines.length) {
    const fence = lines[i].match(MEMO_FILE_FENCE_RE)
    if (fence) {
      flushMd()
      segs.push({
        type: 'file',
        attrs: {
          fileId: fence[1],
          name: fence[2] || fence[1],
          suffix: fence[3] || '',
          size: Number(fence[4] || 0),
          mime: fence[5] || '',
          isDir: fence[6] === 'true',
        },
      })
      if (lines[i + 1]?.trim() === ':::') i += 1
      i += 1
      continue
    }
    buf.push(lines[i])
    i += 1
  }
  flushMd()
  return segs
}

export function memoBoardHref(memoId: string) {
  return `/board/${memoId}`
}

export function memoFileHref(fileId: string) {
  return `/apis/file/${fileId}`
}

export function parseMemoBoardId(href: string) {
  const m = href.trim().match(/^\/board\/([^/?#]+)$/)
  return m?.[1] ?? null
}

export function parseMemoFileHrefId(href: string) {
  const m = href.trim().match(/^\/apis\/file\/([^/?#]+)(?:\/content)?$/)
  return m?.[1] ?? null
}

function escapeMd(text: string) {
  return text.replace(/\\/g, '\\\\')
}

function marksToMd(text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) {
  let out = escapeMd(text)
  if (!marks?.length) return out
  const href = marks.find((m) => m.type === 'link')?.attrs?.href
  if (typeof href === 'string' && href) out = `[${out}](${href})`
  if (marks.some((m) => m.type === 'code')) out = `\`${text}\``
  if (marks.some((m) => m.type === 'bold')) out = `**${out}**`
  if (marks.some((m) => m.type === 'italic')) out = `*${out}*`
  if (marks.some((m) => m.type === 'strike')) out = `~~${out}~~`
  return out
}

function inlineMd(nodes?: JSONContent[]): string {
  if (!nodes?.length) return ''
  return nodes
    .map((node) => {
      if (node.type === 'text') return marksToMd(node.text || '', node.marks)
      if (node.type === 'hardBreak') return '  \n'
      if (node.type === 'memoWikiLink') {
        const memoId = String(node.attrs?.memoId || '').trim()
        const title = String(node.attrs?.title || '').trim()
        if (memoId && title) return `[[memo:${memoId}|${title}]]`
        if (memoId) return `[[memo:${memoId}]]`
        if (title) return `[[${title}]]`
        return ''
      }
      if (node.content) return inlineMd(node.content)
      return ''
    })
    .join('')
}

export function memoJsonToMd(doc: JSONContent): string {
  const lines: string[] = []
  const walk = (node: JSONContent) => {
    const type = node.type || ''
    if (type === 'doc') {
      node.content?.forEach(walk)
      return
    }
    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1)))
      lines.push(`${'#'.repeat(level)} ${inlineMd(node.content)}`.trimEnd())
      lines.push('')
      return
    }
    if (type === 'paragraph') {
      const text = inlineMd(node.content)
      if (text) lines.push(text)
      lines.push('')
      return
    }
    if (type === 'bulletList') {
      for (const item of node.content || []) {
        lines.push(`- ${inlineMd(item.content?.[0]?.content || item.content)}`)
      }
      lines.push('')
      return
    }
    if (type === 'orderedList') {
      ;(node.content || []).forEach((item, i) => {
        lines.push(`${i + 1}. ${inlineMd(item.content?.[0]?.content || item.content)}`)
      })
      lines.push('')
      return
    }
    if (type === 'blockquote') {
      const inner = inlineMd(node.content?.[0]?.content || node.content)
      lines.push(`> ${inner}`)
      lines.push('')
      return
    }
    if (type === 'codeBlock') {
      const code = (node.content || []).map((c) => c.text || '').join('\n')
      lines.push('```')
      lines.push(code)
      lines.push('```')
      lines.push('')
      return
    }
    if (type === 'horizontalRule') {
      lines.push('---')
      lines.push('')
      return
    }
    if (type === 'image') {
      const alt = String(node.attrs?.alt || '')
      const rawSrc = String(node.attrs?.src || '')
      const fileId =
        (typeof node.attrs?.fileId === 'string' && node.attrs.fileId) ||
        parseMemoImageFileId(rawSrc) ||
        ''
      const src = rawSrc.startsWith('data:')
        ? rawSrc
        : fileId
          ? memoImageContentUrl(fileId)
          : rawSrc
      if (src) {
        lines.push(`![${alt}](${src})`)
        lines.push('')
      }
      return
    }
    if (type === 'memoWorkspaceFile') {
      const a = node.attrs || {}
      const id = String(a.fileId || '')
      const name = String(a.name || id).replace(/"/g, '')
      if (id) {
        const suffix = String(a.suffix || '').replace(/"/g, '')
        const size = Number(a.size) || 0
        const mime = String(a.mime || '').replace(/"/g, '')
        const dir = a.isDir ? 'true' : 'false'
        lines.push(
          `:::file id="${id}" name="${name}" suffix="${suffix}" size="${size}" mime="${mime}" dir="${dir}"`
        )
        lines.push(':::')
        lines.push('')
      }
      return
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function parseInline(text: string, store: string[] = []): JSONContent[] {
  const nodes: JSONContent[] = []
  const re = /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[1]) {
      const raw = m[1].trim()
      const alias = (m[2] || '').trim()
      const memoId = raw.startsWith('memo:') ? raw.slice(5).trim() : ''
      const title = alias || (memoId ? '' : raw.replace(/\.md$/i, ''))
      nodes.push({
        type: 'memoWikiLink',
        attrs: { memoId, title },
      })
    } else if (m[4]) {
      const src = resolveShieldedImageSrc(m[4], store)
      nodes.push({
        type: 'image',
        attrs: {
          src,
          alt: m[3] || '',
          fileId: parseMemoImageFileId(src),
        },
      })
    } else if (m[6]) {
      const boardId = parseMemoBoardId(m[6])
      if (boardId) {
        nodes.push({
          type: 'memoWikiLink',
          attrs: { memoId: boardId, title: (m[5] || '').trim() },
        })
      } else {
        nodes.push({
          type: 'text',
          text: m[5],
          marks: [{ type: 'link', attrs: { href: m[6] } }],
        })
      }
    } else if (m[7]) {
      nodes.push({ type: 'text', text: m[7], marks: [{ type: 'code' }] })
    } else if (m[8]) {
      nodes.push({ type: 'text', text: m[8], marks: [{ type: 'bold' }] })
    } else if (m[9]) {
      nodes.push({ type: 'text', text: m[9], marks: [{ type: 'italic' }] })
    } else if (m[10]) {
      nodes.push({ type: 'text', text: m[10], marks: [{ type: 'strike' }] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) })
  return nodes.length ? nodes : []
}

function paragraph(text: string, store: string[] = []): JSONContent {
  return { type: 'paragraph', content: parseInline(text, store) }
}

/** 拖进编辑器时留下的 freefs-memo:[{id,title}]，读的时候当成软链接。 */
function expandFreefsMemoPayloads(markdown: string): string {
  const prefix = 'freefs-memo:'
  let out = ''
  let i = 0
  while (i < markdown.length) {
    const at = markdown.indexOf(prefix, i)
    if (at < 0) {
      out += markdown.slice(i)
      break
    }
    out += markdown.slice(i, at)
    const jsonAt = at + prefix.length
    if (markdown[jsonAt] !== '[') {
      out += prefix
      i = jsonAt
      continue
    }
    let depth = 0
    let end = -1
    for (let c = jsonAt; c < markdown.length; c++) {
      if (markdown[c] === '[') depth += 1
      else if (markdown[c] === ']') {
        depth -= 1
        if (depth === 0) {
          end = c + 1
          break
        }
      }
    }
    if (end < 0) {
      out += markdown.slice(at)
      break
    }
    try {
      const parsed = JSON.parse(markdown.slice(jsonAt, end)) as { id?: string; title?: string }[]
      const links = parsed
        .filter((item) => item?.id)
        .map((item) => {
          const title = String(item.title || '').replace(/[[\]|]/g, '').trim()
          return title ? `[[memo:${item.id}|${title}]]` : `[[memo:${item.id}]]`
        })
      out += links.join(' ')
    } catch {
      out += markdown.slice(at, end)
    }
    i = end
  }
  return out
}

/** 导出 / 发聊天：去掉软连接和 fileshare 引用，图留在正文里。 */
export function stripMemoExportRefs(markdown: string): string {
  const expanded = expandFreefsMemoPayloads(markdown || '')
  const lines = expanded.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const fence = lines[i].match(MEMO_FILE_FENCE_RE)
    if (fence) {
      if (lines[i + 1]?.trim() === ':::') i += 1
      i += 1
      continue
    }
    if (/^\[[^\]]+\]\(\/apis\/file\/[^)]+\)$/.test(lines[i].trim())) {
      i += 1
      continue
    }
    const cleaned = lines[i]
      .replace(/\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g, '')
      .replace(/\[[^\]]+\]\(\/board\/[^)]+\)/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+$/g, '')
    out.push(cleaned)
    i += 1
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function memoMdToJson(md: string): JSONContent {
  const content: JSONContent[] = []
  const shielded = shieldDataImagesInMarkdown(expandFreefsMemoPayloads(md || ''))
  const lines = shielded.md
    .replace(/\r\n/g, '\n')
    .replace(/\\([\\`*_[\]#])/g, '$1')
    .split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(MEMO_FILE_FENCE_RE)
    if (fence) {
      content.push({
        type: 'memoWorkspaceFile',
        attrs: {
          fileId: fence[1],
          name: fence[2] || '',
          suffix: fence[3] || '',
          size: Number(fence[4] || 0),
          mime: fence[5] || '',
          isDir: fence[6] === 'true',
        },
      })
      if (lines[i + 1]?.trim() === ':::') i += 1
      i += 1
      continue
    }
    const fileLine = line.match(/^\[([^\]]+)\]\((\/apis\/file\/[^)]+)\)$/)
    if (fileLine) {
      const fileId = parseMemoFileHrefId(fileLine[2])
      if (fileId) {
        content.push({
          type: 'memoWorkspaceFile',
          attrs: {
            fileId,
            name: fileLine[1],
            suffix: '',
            size: 0,
            mime: '',
            isDir: false,
          },
        })
        i += 1
        continue
      }
    }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (img) {
      const src = resolveShieldedImageSrc(img[2], shielded.store)
      const fileId = parseMemoImageFileId(src)
      content.push({
        type: 'image',
        attrs: {
          src,
          alt: img[1],
          fileId,
        },
      })
      i += 1
      continue
    }
    if (line.trim() === '---') {
      content.push({ type: 'horizontalRule' })
      i += 1
      continue
    }
    if (line.startsWith('```')) {
      const buf: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i += 1
      }
      content.push({
        type: 'codeBlock',
        content: buf.length ? [{ type: 'text', text: buf.join('\n') }] : [],
      })
      i += 1
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: parseInline(heading[2], shielded.store),
      })
      i += 1
      continue
    }
    if (line.startsWith('> ')) {
      content.push({
        type: 'blockquote',
        content: [paragraph(line.slice(2), shielded.store)],
      })
      i += 1
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push({
          type: 'listItem',
          content: [paragraph(lines[i].replace(/^[-*]\s+/, ''), shielded.store)],
        })
        i += 1
      }
      content.push({ type: 'bulletList', content: items })
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push({
          type: 'listItem',
          content: [paragraph(lines[i].replace(/^\d+\.\s+/, ''), shielded.store)],
        })
        i += 1
      }
      content.push({ type: 'orderedList', content: items })
      continue
    }
    if (line.trim()) content.push(paragraph(line, shielded.store))
    i += 1
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function memoMdPlainText(md: string) {
  return (md || '')
    .replace(MEMO_FILE_FENCE_RE, ' $2 ')
    .replace(/\[\[[^\]|]+(?:\|([^\]]+))?\]\]/g, ' $1 ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*`~\-\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function memoMdImageIds(md: string) {
  const ids: string[] = []
  const re = /!\[[^\]]*\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md || ''))) {
    const id = parseMemoImageFileId(m[1])
    if (id) ids.push(id)
  }
  return ids
}

export function htmlFallbackToMd(html: string) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<h1[^>]*>/gi, '# ')
    .replace(/<h2[^>]*>/gi, '## ')
    .replace(/<h3[^>]*>/gi, '### ')
    .replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, '![]($1)')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
