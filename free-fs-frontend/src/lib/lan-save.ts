/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

type Writable = {
  write: (data: BufferSource) => Promise<void>
  close: () => Promise<void>
  abort?: () => Promise<void>
}

type DirHandle = {
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirHandle>
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
    createWritable: (opts?: { keepExistingData?: boolean }) => Promise<Writable>
  }>
  removeEntry?: (name: string, opts?: { recursive?: boolean }) => Promise<void>
}

type OpenWrite = {
  dir: DirHandle
  fileName: string
  writable: Writable
}

const opens = new Map<string, OpenWrite>()
const buffers = new Map<string, BlobPart[]>()
let queue: Promise<void> = Promise.resolve()

export async function pickLanDirectory(): Promise<DirHandle | null> {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirHandle> })
    .showDirectoryPicker
  if (!picker) return null
  return picker()
}

async function ensureDir(root: DirHandle, relativePath: string) {
  const parts = relativePath.split('/').filter(Boolean)
  const fileName = parts.pop() || 'file'
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return { dir, fileName }
}

async function removeSwap(dir: DirHandle, fileName: string) {
  try {
    await dir.removeEntry?.(`${fileName}.crswap`)
  } catch {
    // already swapped or not visible
  }
}

async function closeOpen(path: string) {
  const open = opens.get(path)
  if (!open) return
  opens.delete(path)
  try {
    await open.writable.close()
  } catch {
    try {
      await open.writable.abort?.()
    } catch {
      // ignore
    }
  }
  await removeSwap(open.dir, open.fileName)
}

export async function writeLanChunk(
  root: DirHandle | null,
  relativePath: string,
  chunk: ArrayBuffer,
  done: boolean
) {
  const path = relativePath.replace(/\\/g, '/')
  queue = queue.then(async () => {
    if (root) {
      let open = opens.get(path)
      if (!open) {
        const { dir, fileName } = await ensureDir(root, path)
        const file = await dir.getFileHandle(fileName, { create: true })
        const writable = await file.createWritable({ keepExistingData: false })
        open = { dir, fileName, writable }
        opens.set(path, open)
      }
      if (chunk.byteLength > 0) {
        await open.writable.write(chunk)
      }
      if (done) {
        await closeOpen(path)
      }
      return
    }

    const parts = buffers.get(path) ?? []
    if (chunk.byteLength > 0) parts.push(chunk)
    buffers.set(path, parts)
    if (done) {
      const blob = new Blob(parts)
      buffers.delete(path)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = path.split('/').pop() || 'file'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }
  })
  await queue
}

export async function finishLanSaves() {
  await queue
  await Promise.all([...opens.keys()].map((path) => closeOpen(path)))
  buffers.clear()
}

export function resetLanSaves() {
  void finishLanSaves()
}
