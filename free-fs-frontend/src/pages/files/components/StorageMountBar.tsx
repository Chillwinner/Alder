/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { HardDrive, Folder } from 'lucide-react'
import { getFolders } from '@/api/file'
import {
  collectImMessageDrag,
  collectMemoDrag,
  FREEFS_IM_MESSAGE_MIME,
  FREEFS_MEMOS_MIME,
  type ImMessageDragItem,
} from '@/components/messages/im-drop-files'
import type { WorkspaceMemo } from '@/types/workspace-board'
import type { FileItem } from '@/types/file'
import { playLandBounce } from '@/lib/drag-layer'
import { cn } from '@/lib/utils'

interface StorageMountBarProps {
  activeId?: string
  currentParentId?: string
  onOpen: (id: string) => void
  onMove: (fileIds: string[], targetDirId: string) => Promise<void>
  onImportIm?: (item: ImMessageDragItem, targetDirId: string) => void
  onImportMemo?: (memos: WorkspaceMemo[], targetDirId: string) => void
}

const OPEN_DELAY_MS = 450

export function StorageMountBar({
  activeId,
  currentParentId,
  onOpen,
  onMove,
  onImportIm,
  onImportMemo,
}: StorageMountBarProps) {
  const [mounts, setMounts] = useState<FileItem[]>([])
  const [overId, setOverId] = useState<string | null>(null)
  const openTimer = useRef<number | null>(null)

  const clearOpenTimer = () => {
    if (openTimer.current != null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }

  useEffect(() => clearOpenTimer, [])

  const armOpen = (mountId: string) => {
    if (currentParentId === mountId) return
    if (openTimer.current != null) return
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null
      onOpen(mountId)
    }, OPEN_DELAY_MS)
  }

  useEffect(() => {
    let cancelled = false
    getFolders()
      .then((list) => {
        if (!cancelled) setMounts(list ?? [])
      })
      .catch(() => {
        if (!cancelled) setMounts([])
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  if (mounts.length === 0) return null

  return (
    <div className='flex gap-2 overflow-x-auto px-6 pb-2 sm:px-8'>
      {mounts.map((mount) => {
        const active = activeId === mount.id
        return (
          <button
            key={mount.id}
            type='button'
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-all duration-150 active:scale-[0.99]',
              active
                ? 'border-primary bg-accent-soft text-primary shadow-sm'
                : 'border-border bg-surface-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground',
              overId === mount.id && 'border-primary bg-accent-soft text-primary'
            )}
            onClick={() => onOpen(mount.id)}
            onDragOver={(event) => {
              const types = Array.from(event.dataTransfer.types)
              const chat = types.includes(FREEFS_IM_MESSAGE_MIME)
              const memo = types.includes(FREEFS_MEMOS_MIME)
              const files = types.includes('application/json')
              if (!chat && !memo && !files) return
              event.preventDefault()
              event.stopPropagation()
              event.dataTransfer.dropEffect = chat || memo ? 'copy' : 'move'
              setOverId(mount.id)
              armOpen(mount.id)
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget
              if (next instanceof Node && event.currentTarget.contains(next)) return
              clearOpenTimer()
              setOverId((current) => (current === mount.id ? null : current))
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              clearOpenTimer()
              setOverId(null)
              if (currentParentId === mount.id) {
                const memos = collectMemoDrag(event)
                if (memos.length > 0 && onImportMemo) {
                  onImportMemo(memos, mount.id)
                  playLandBounce(event.currentTarget)
                  return
                }
                const chatItem = collectImMessageDrag(event)
                if (chatItem && onImportIm) {
                  onImportIm(chatItem, mount.id)
                  playLandBounce(event.currentTarget)
                  return
                }
                const raw = event.dataTransfer.getData('application/json')
                if (!raw) return
                try {
                  const ids = JSON.parse(raw) as string[]
                  if (Array.isArray(ids) && ids.length > 0) {
                    void onMove(ids, mount.id)
                    playLandBounce(event.currentTarget)
                  }
                } catch {
                  // 不是文件拖拽
                }
                return
              }
              onOpen(mount.id)
            }}
          >
            {mount.id === 'mnt:local' ? (
              <Folder className='size-4' />
            ) : (
              <HardDrive className='size-4' />
            )}
            <span className='max-w-40 truncate'>{mount.displayName}</span>
          </button>
        )
      })}
    </div>
  )
}
