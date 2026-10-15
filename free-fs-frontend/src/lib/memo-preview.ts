/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Editor, type JSONContent } from '@tiptap/core'
import * as Y from 'yjs'
import { getMemoBody, getMemoListPreview, getMemoYjsState } from '@/api/workspace-board'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { base64ToBytes } from '@/lib/base64-bytes'
import { buildMemoEditorExtensions } from '@/lib/memo-editor-extensions'
import { parseMemoImageFileId } from '@/lib/memo-insert-image'
import { htmlFallbackToMd, memoMdImageIds, memoMdPlainText, memoMdToJson } from '@/lib/memo-md'

export type MemoListPreview = {
  text: string
  imageFileIds: string[]
}

function walkJson(
  node: Record<string, unknown>,
  textParts: string[],
  imageFileIds: string[]
) {
  if (node.type === 'text' && typeof node.text === 'string') {
    const t = node.text.trim()
    if (t) textParts.push(t)
  }
  if (node.type === 'memoWorkspaceFile') {
    const attrs = node.attrs as Record<string, unknown> | undefined
    const name = typeof attrs?.name === 'string' ? attrs.name.trim() : ''
    if (name) textParts.push(name)
  }
  if (node.type === 'image') {
    const attrs = node.attrs as Record<string, unknown> | undefined
    const fileId =
      (typeof attrs?.fileId === 'string' ? attrs.fileId : null) ||
      parseMemoImageFileId(String(attrs?.src ?? ''))
    if (fileId) imageFileIds.push(fileId)
  }
  const content = node.content
  if (Array.isArray(content)) {
    for (const child of content) {
      if (child && typeof child === 'object') {
        walkJson(child as Record<string, unknown>, textParts, imageFileIds)
      }
    }
  }
}

export function extractMemoPreviewFromDoc(doc: Y.Doc): MemoListPreview {
  const editor = new Editor({
    extensions: buildMemoEditorExtensions(doc),
    editable: false,
  })
  try {
    const json = editor.getJSON()
    const textParts: string[] = []
    const imageFileIds: string[] = []
    walkJson(json as Record<string, unknown>, textParts, imageFileIds)
    return {
      text: textParts.join(' ').replace(/\s+/g, ' ').trim(),
      imageFileIds,
    }
  } finally {
    editor.destroy()
  }
}

function previewFromMarkdown(md: string): MemoListPreview {
  return {
    text: memoMdPlainText(md),
    imageFileIds: memoMdImageIds(md),
  }
}

function previewFromHtml(html: string): MemoListPreview {
  return previewFromMarkdown(htmlFallbackToMd(html))
}

export async function loadMemoTipTapJson(
  memo: WorkspaceMemo
): Promise<JSONContent | null> {
  try {
    const body = await getMemoBody(memo.id)
    const md = (body.bodyMd || '').trim() || htmlFallbackToMd(body.bodyHtml || '')
    if (md) return memoMdToJson(md)
    if (memo.visibility === 'private') return memoMdToJson('')
    const state = await getMemoYjsState(memo.id)
    const doc = new Y.Doc()
    if (state?.payloadBase64) {
      const bytes = base64ToBytes(state.payloadBase64)
      if (bytes.length) Y.applyUpdate(doc, bytes, 'server')
    }
    const editor = new Editor({
      extensions: buildMemoEditorExtensions(doc),
      editable: false,
    })
    try {
      return editor.getJSON()
    } finally {
      editor.destroy()
    }
  } catch {
    return null
  }
}

export async function fetchMemoListPreview(
  memo: WorkspaceMemo | string
): Promise<MemoListPreview | null> {
  if (typeof memo !== 'string' && memo.kind === 'canvas') {
    return { text: '', imageFileIds: [] }
  }
  const memoId = typeof memo === 'string' ? memo : memo.id
  try {
    const preview = await getMemoListPreview(memoId)
    return { text: (preview.text || '').trim(), imageFileIds: [] }
  } catch {
    return null
  }
}
