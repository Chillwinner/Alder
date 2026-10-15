/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import { Archive } from 'libarchive.js'
import { FileIcon } from '@/components/file-icon'
import { previewPaneClass } from '@/components/preview/preview-glass'
import { formatFileSize } from '@/config/upload-limits'
import { cn } from '@/lib/utils'

type ArchivePreviewProps = {
  blob: Blob
  fileName: string
}

type ArchiveNode = {
  name: string
  path: string
  size: number
  isDir: boolean
  children: ArchiveNode[]
}

type ArchiveFile = {
  name: string
  size: number
}

type ListedEntry = {
  file: ArchiveFile
  path: string
}

let archiveInited = false

function ensureArchiveRuntime() {
  if (archiveInited) return
  Archive.init({
    workerUrl: '/libarchive/worker-bundle.js',
  })
  archiveInited = true
}

function fileSuffix(name: string): string {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : name
}

function compareNodes(left: ArchiveNode, right: ArchiveNode): number {
  if (left.isDir !== right.isDir) return left.isDir ? -1 : 1
  return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
}

function insertFile(root: ArchiveNode, parentPath: string, name: string, size: number) {
  const parts = parentPath.split('/').filter(Boolean)
  let current = root
  let walk = ''
  for (const part of parts) {
    walk = walk ? `${walk}/${part}` : part
    let next = current.children.find((child) => child.isDir && child.name === part)
    if (!next) {
      next = { name: part, path: walk, size: 0, isDir: true, children: [] }
      current.children.push(next)
    }
    current = next
  }
  current.children.push({
    name,
    path: walk ? `${walk}/${name}` : name,
    size,
    isDir: false,
    children: [],
  })
}

function sortTree(node: ArchiveNode) {
  node.children.sort(compareNodes)
  for (const child of node.children) {
    if (child.isDir) sortTree(child)
  }
}

function countFiles(node: ArchiveNode): number {
  if (!node.isDir) return 1
  return node.children.reduce((total, child) => total + countFiles(child), 0)
}

function countDirs(node: ArchiveNode): number {
  return node.children.reduce((total, child) => {
    if (!child.isDir) return total
    return total + 1 + countDirs(child)
  }, 0)
}

async function listArchiveEntries(blob: Blob, fileName: string): Promise<ArchiveNode> {
  ensureArchiveRuntime()
  const file = new File([blob], fileName)
  const reader = await Archive.open(file)
  try {
    const encrypted = await reader.hasEncryptedData()
    if (encrypted) {
      throw new Error('encrypted')
    }
    const listed = (await reader.getFilesArray()) as ListedEntry[]
    const root: ArchiveNode = { name: fileName, path: '', size: 0, isDir: true, children: [] }
    for (const entry of listed) {
      const name = entry.file?.name
      if (!name) continue
      insertFile(root, entry.path || '', name, entry.file.size || 0)
    }
    sortTree(root)
    return root
  } finally {
    await reader.close()
  }
}

function ArchiveTreeNode({ node, depth }: { node: ArchiveNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)

  if (!node.isDir) {
    return (
      <div
        className='flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary'
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <span className='w-4 shrink-0' />
        <FileIcon type={fileSuffix(node.name)} size={18} />
        <span className='min-w-0 flex-1 truncate'>{node.name}</span>
        <span className='font-mono text-xs shrink-0 tabular-nums text-muted-foreground'>
          {formatFileSize(node.size)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <button
        type='button'
        className='flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-secondary transition-colors duration-150 hover:bg-surface-hover active:scale-[0.99]'
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <ChevronDown className='text-muted-foreground size-4 shrink-0' />
        ) : (
          <ChevronRight className='text-muted-foreground size-4 shrink-0' />
        )}
        <Folder className='size-[18px] shrink-0 text-warning' />
        <span className='min-w-0 flex-1 truncate'>{node.name}</span>
        <span className='font-mono text-xs shrink-0 tabular-nums text-muted-foreground'>
          {node.children.length}
        </span>
      </button>
      {open &&
        node.children.map((child) => (
          <ArchiveTreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
    </div>
  )
}

export function ArchivePreview({ blob, fileName }: ArchivePreviewProps) {
  const { t } = useTranslation('common')
  const [tree, setTree] = useState<ArchiveNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setTree(null)
    setError(null)

    void listArchiveEntries(blob, fileName)
      .then((next) => {
        if (!cancelled) setTree(next)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        const message = cause instanceof Error ? cause.message : ''
        setError(message === 'encrypted' ? t('preview.archiveEncrypted') : t('preview.loadFailed'))
      })

    return () => {
      cancelled = true
    }
  }, [blob, fileName, t])

  const summary = useMemo(() => {
    if (!tree) return null
    return {
      files: countFiles(tree),
      folders: countDirs(tree),
    }
  }, [tree])

  if (error) {
    return (
      <div className='text-destructive flex h-full items-center justify-center px-8 text-center text-sm'>
        {error}
      </div>
    )
  }

  if (!tree || !summary) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('loading')}
      </div>
    )
  }

  if (summary.files === 0) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('preview.archiveEmpty')}
      </div>
    )
  }

  return (
    <div className={cn(previewPaneClass, 'flex h-full min-h-0 flex-col overflow-hidden rounded-md')}>
      <div className='text-muted-foreground shrink-0 border-b border-border px-3 py-2 font-mono text-[11px] tracking-wider'>
        {t('preview.archiveSummary', { files: summary.files, folders: summary.folders })}
      </div>
      <div className='min-h-0 flex-1 overflow-auto'>
        {tree.children.map((child) => (
          <ArchiveTreeNode key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  )
}
