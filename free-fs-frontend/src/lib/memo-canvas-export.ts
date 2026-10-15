/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getMemoCanvas } from '@/api/workspace-board'
import { prepareCanvasDocument } from '@/lib/memo-canvas'
import type { WorkspaceMemo } from '@/types/workspace-board'

function downloadBlob(filename: string, blob: Blob) {
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

function safeName(title: string) {
  return (title || 'canvas').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'canvas'
}

export async function packageMemoCanvasExport(memo: WorkspaceMemo, mode: 'chat' | 'local') {
  const vo = await getMemoCanvas(memo.id)
  const document = prepareCanvasDocument(vo.document || '', { dropLinks: mode === 'local' })
  const file = new File([document], `${safeName(memo.title)}.canvas`, {
    type: 'application/json;charset=utf-8',
  })
  return { file, attachments: [] as File[] }
}

export async function exportMemoCanvas(memo: WorkspaceMemo) {
  const pack = await packageMemoCanvasExport(memo, 'local')
  downloadBlob(pack.file.name, pack.file)
}
