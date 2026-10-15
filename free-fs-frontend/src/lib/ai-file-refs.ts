/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export type AiFileRef = {
  id: string
  displayName: string
  isDir?: boolean
  size?: number
  suffix?: string
}

export type AiMemoRef = {
  id: string
  title: string
}

const FILE_TOKEN = /«fs:(\{[\s\S]*?\})»/g
const MEMO_TOKEN = /«memo:(\{[\s\S]*?\})»/g
const OBJECT = /\{[^{}]*"id"\s*:\s*"[^"]+"[^{}]*\}/g

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function readId(row: Record<string, unknown>) {
  return typeof row.id === 'string' ? row.id.trim() : ''
}

function readMemo(raw: unknown): AiMemoRef | null {
  const row = asRecord(raw)
  if (!row) return null
  const id = readId(row)
  if (!id) return null
  const kind = typeof row.kind === 'string' ? row.kind : ''
  const title =
    typeof row.title === 'string'
      ? row.title
      : typeof row.displayName === 'string' && (kind === 'memo' || row.size == null)
        ? row.displayName
        : ''
  if (kind === 'memo' || (typeof row.title === 'string' && row.displayName == null)) {
    return { id, title: title || id }
  }
  return null
}

function readFile(raw: unknown): AiFileRef | null {
  const row = asRecord(raw)
  if (!row) return null
  if (typeof row.kind === 'string' && row.kind === 'memo') return null
  if (typeof row.title === 'string' && row.displayName == null) return null
  const id = readId(row)
  if (!id) return null
  const displayName =
    typeof row.displayName === 'string'
      ? row.displayName
      : typeof row.name === 'string'
        ? row.name
        : ''
  const size = typeof row.size === 'number' ? row.size : undefined
  const suffix = typeof row.suffix === 'string' ? row.suffix : undefined
  const isDir = row.isDir === true || row.isDir === 'true'
  if (!displayName && !isDir && size == null && !suffix) return null
  return { id, displayName: displayName || id, isDir, size, suffix }
}

export function looksLikeMemoFileRef(file: AiFileRef) {
  if (file.isDir || file.id.startsWith('mnt:')) return false
  if (file.suffix) return false
  if (file.displayName.includes('.')) return false
  return file.size == null || file.size === 0
}

export function parseAiFileMessage(text: string): {
  prose: string
  files: AiFileRef[]
  memos: AiMemoRef[]
} {
  const files: AiFileRef[] = []
  const memos: AiMemoRef[] = []
  const seenFile = new Set<string>()
  const seenMemo = new Set<string>()

  const pushFile = (ref: AiFileRef | null) => {
    if (!ref || seenFile.has(ref.id) || seenMemo.has(ref.id)) return
    if (looksLikeMemoFileRef(ref)) {
      seenMemo.add(ref.id)
      memos.push({ id: ref.id, title: ref.displayName })
      return
    }
    seenFile.add(ref.id)
    files.push(ref)
  }
  const pushMemo = (ref: AiMemoRef | null) => {
    if (!ref || seenMemo.has(ref.id)) return
    seenMemo.add(ref.id)
    memos.push(ref)
  }

  let prose = text
  prose = prose.replace(MEMO_TOKEN, (_, json: string) => {
    try {
      pushMemo(readMemo({ ...(JSON.parse(json) as object), kind: 'memo' }))
    } catch {
      // ignore
    }
    return ' '
  })
  prose = prose.replace(FILE_TOKEN, (_, json: string) => {
    try {
      const parsed = JSON.parse(json) as unknown
      pushMemo(readMemo(parsed))
      pushFile(readFile(parsed))
    } catch {
      // ignore
    }
    return ' '
  })
  prose = prose.replace(OBJECT, (block) => {
    try {
      const parsed = JSON.parse(block) as unknown
      const memo = readMemo(parsed)
      if (memo) {
        pushMemo(memo)
        return ' '
      }
      const file = readFile(parsed)
      if (file) {
        pushFile(file)
        return ' '
      }
    } catch {
      // keep
    }
    return block
  })

  prose = prose.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
  return { prose, files, memos }
}
