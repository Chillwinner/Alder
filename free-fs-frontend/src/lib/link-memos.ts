/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getMemoPreviewBody, saveMemoBody } from '@/api/workspace-board'
import { htmlFallbackToMd } from '@/lib/memo-md'
import { requestInsertMemoLinks } from '@/lib/memo-wiki-link'
import type { WorkspaceMemo } from '@/types/workspace-board'

function appendWikiLinksToMd(md: string, memos: WorkspaceMemo[]) {
  let next = md
  for (const memo of memos) {
    const title = memo.title?.trim()
    if (!title) continue
    const token = `[[${title}]]`
    if (next.includes(token)) continue
    next = `${next.trimEnd()}${next.trim() ? '\n\n' : ''}${token}\n`
  }
  return next
}

export async function linkMemosOnto(targetMemoId: string, sources: WorkspaceMemo[]) {
  const memos = sources.filter((item) => item.id && item.id !== targetMemoId)
  if (!memos.length) return false
  const detail = requestInsertMemoLinks(targetMemoId, memos)
  if (detail.handled) return true
  const body = await getMemoPreviewBody(targetMemoId)
  const current = (body.bodyMd || '').trim() || htmlFallbackToMd(body.bodyHtml || '')
  const next = appendWikiLinksToMd(current, memos)
  if (next === current) return false
  await saveMemoBody(targetMemoId, { bodyMd: next })
  window.dispatchEvent(
    new CustomEvent('alder:memo-body-updated', {
      detail: { memoId: targetMemoId, bodyMd: next },
    })
  )
  return true
}
