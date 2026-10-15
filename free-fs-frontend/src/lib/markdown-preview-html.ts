/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getFileContent } from '@/api/file'
import { parseMemoImageFileId } from '@/lib/memo-insert-image'
import {
  restoreDataImagesInHtml,
  shieldDataImagesInMarkdown,
} from '@/lib/md-data-images'

const ALLOWED_TAGS = new Set([
  'A',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'DIV',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
])

const ALLOWED_STYLE = new Set([
  'color',
  'display',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'margin',
  'margin-left',
  'margin-right',
  'max-width',
  'text-align',
  'text-decoration',
  'width',
])

function isSafeHref(href: string) {
  const v = href.trim()
  return /^(https?:|mailto:|tel:|#|\/board\/|\/w\/|\/apis\/file\/)/i.test(v)
}

function isSafeImgSrc(src: string) {
  const v = src.trim()
  if (/^data:image\/[a-z0-9.+-]+/i.test(v) && /;base64,/i.test(v)) return true
  return /^(https?:|blob:|alder-data-image:|\/apis\/file\/)/i.test(v.split('?')[0])
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

async function inlineWorkspaceFileImages(html: string) {
  const doc = new DOMParser().parseFromString(`<div id="md-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('md-root')
  if (!root) return html
  await Promise.all(
    [...root.querySelectorAll('img')].map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (src.startsWith('data:') || src.startsWith('blob:')) return
      const fileId =
        parseMemoImageFileId(src) ||
        src.trim().match(/^\/apis\/file\/([^/?#]+)(?:\/content)?$/)?.[1]
      if (!fileId) return
      try {
        img.setAttribute('src', await blobToDataUrl(await getFileContent(fileId)))
      } catch {
        /* 预览里带不上登录态的 /apis/file 链接，失败就保持原样 */
      }
    })
  )
  return root.innerHTML
}

function sanitizeStyle(value: string) {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx < 0) return ''
      const name = part.slice(0, idx).trim().toLowerCase()
      const val = part.slice(idx + 1).trim()
      if (!ALLOWED_STYLE.has(name) || /expression|url\s*\(|javascript:/i.test(val)) {
        return ''
      }
      return `${name}:${val}`
    })
    .filter(Boolean)
    .join(';')
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (!ALLOWED_TAGS.has(el.tagName)) {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
    return
  }
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on') || name === 'srcdoc') {
      el.removeAttribute(attr.name)
      continue
    }
    if (name === 'href') {
      if (!isSafeHref(attr.value)) el.removeAttribute(attr.name)
      continue
    }
    if (name === 'src') {
      if (el.tagName === 'IMG' && isSafeImgSrc(attr.value)) continue
      el.removeAttribute(attr.name)
      continue
    }
    if (name === 'style') {
      const next = sanitizeStyle(attr.value)
      if (next) el.setAttribute('style', next)
      else el.removeAttribute('style')
      continue
    }
    if (!['alt', 'title', 'width', 'height', 'start', 'colspan', 'rowspan'].includes(name)) {
      el.removeAttribute(attr.name)
    }
  }
  for (const child of [...el.childNodes]) sanitizeNode(child)
}

export function sanitizePreviewHtml(html: string) {
  const doc = new DOMParser().parseFromString(`<div id="md-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('md-root')
  if (!root) return ''
  for (const child of [...root.childNodes]) sanitizeNode(child)
  return root.innerHTML
}

const PREVIEW_CSS = `
:root {
  --md-bg: #f4f4f5;
  --md-fg: #18181b;
  --md-muted: #52525b;
  --md-line: rgba(24, 24, 27, 0.14);
  --md-chip: rgba(24, 24, 27, 0.07);
}
:root[data-theme="dark"] {
  --md-bg: #18181b;
  --md-fg: #fafafa;
  --md-muted: #a1a1aa;
  --md-line: rgba(250, 250, 250, 0.16);
  --md-chip: rgba(250, 250, 250, 0.08);
}
html, body {
  margin: 0;
  min-height: 100%;
  padding: 20px 24px 32px;
  background: var(--md-bg);
  color: var(--md-fg);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.65;
}
h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.8em; }
h2 { font-size: 1.15rem; font-weight: 650; margin: 1.2em 0 0.6em; }
h3, h4, h5, h6 { font-size: 1rem; font-weight: 650; margin: 1em 0 0.5em; }
p { margin: 0.55em 0; }
ul, ol { margin: 0.55em 0; padding-left: 1.4em; }
li { margin: 0.2em 0; }
blockquote {
  margin: 0.7em 0;
  padding: 0.1em 0 0.1em 0.9em;
  border-left: 2px solid var(--md-line);
  color: var(--md-muted);
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--md-chip);
}
pre {
  overflow: auto;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--md-chip);
}
pre code { padding: 0; background: none; }
img { max-width: 100%; height: auto; vertical-align: middle; }
hr {
  border: 0;
  border-top: 1px solid var(--md-line);
  margin: 1.2em 0;
}
u { text-decoration: underline; }
s, del { text-decoration: line-through; }
a { color: inherit; text-decoration: underline; }
`

export function wrapMarkdownPreviewDocument(
  bodyHtml: string,
  mode: 'light' | 'dark' = 'light'
) {
  return `<!doctype html><html data-theme="${mode}"><head><meta charset="utf-8"><meta name="color-scheme" content="${mode}"><style>${PREVIEW_CSS}</style></head><body>${bodyHtml}</body></html>`
}

function looksLikeHtml(source: string) {
  if (/^:::file\b/m.test(source)) return false
  return /<\/?(h[1-6]|p|img|ul|ol|blockquote|pre|hr|table|div|span|strong|em)\b/i.test(
    source
  )
}

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string) {
  return escapeText(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function markdownToHtml(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  let list: 'ul' | 'ol' | null = null

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      closeList()
      const buf: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i += 1
      }
      out.push(`<pre><code>${escapeText(buf.join('\n'))}</code></pre>`)
      i += 1
      continue
    }
    if (/^:::file\b/.test(line)) {
      closeList()
      i += 1
      if (lines[i]?.trim() === ':::') i += 1
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      i += 1
      continue
    }
    if (/^---+$/.test(line.trim())) {
      closeList()
      out.push('<hr />')
      i += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      closeList()
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${inlineMarkdown(quote.join('<br>'))}</blockquote>`)
      continue
    }
    const ul = line.match(/^[-*+]\s+(.*)$/)
    if (ul) {
      if (list !== 'ul') {
        closeList()
        out.push('<ul>')
        list = 'ul'
      }
      out.push(`<li>${inlineMarkdown(ul[1])}</li>`)
      i += 1
      continue
    }
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (list !== 'ol') {
        closeList()
        out.push('<ol>')
        list = 'ol'
      }
      out.push(`<li>${inlineMarkdown(ol[1])}</li>`)
      i += 1
      continue
    }
    if (!line.trim()) {
      closeList()
      i += 1
      continue
    }
    closeList()
    out.push(`<p>${inlineMarkdown(line)}</p>`)
    i += 1
  }
  closeList()
  return out.join('\n')
}

export function markdownToPreviewHtml(source: string) {
  const { md, store } = shieldDataImagesInMarkdown(source || '')
  const raw = looksLikeHtml(md) ? md : markdownToHtml(md)
  return sanitizePreviewHtml(restoreDataImagesInHtml(raw, store))
}

export async function markdownSourceToPreviewDocument(
  source: string,
  mode: 'light' | 'dark' = 'light'
) {
  return wrapMarkdownPreviewDocument(markdownToPreviewHtml(source), mode)
}
