/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import { playLandBounce, subscribeDrag } from '@/lib/drag-layer'
import { useTranslation } from 'react-i18next'
import { Folder, Inbox, Star, Trash2 } from 'lucide-react'
import {
  collectImMessageDrag,
  collectMemoDrag,
  FREEFS_IM_MESSAGE_MIME,
  FREEFS_MEMOS_MIME,
  type ImMessageDragItem,
} from '@/components/messages/im-drop-files'
import type { FileItem, BreadcrumbItem } from '@/types/file'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { cn } from '@/lib/utils'

export interface FolderTreeViewEntry {
  id: string
  label: string
  active: boolean
  onClick: () => void
  /**
   * 展示用计数（demo 每行右侧的 mono 数字）。
   * 可选、只参与渲染，组件内不做任何逻辑分支。
   */
  count?: number
}

interface FolderTreeProps {
  /** 当前路径（祖先链，含当前级） */
  pathItems: BreadcrumbItem[]
  /** 当前目录下的子文件夹 */
  subFolders: FileItem[]
  rootActive: boolean
  activePathId?: string
  onRootClick: () => void
  onPathClick: (folderId: string) => void
  onFolderClick: (folder: FileItem) => void
  viewEntries: FolderTreeViewEntry[]
  /** 展示用：根目录「全部文件」右侧的 mono 计数 */
  rootCount?: number
  rootFolderId?: string
  onMove?: (fileIds: string[], targetDirId: string) => void
  onImportIm?: (item: ImMessageDragItem, targetDirId: string) => void
  onImportMemo?: (memos: WorkspaceMemo[], targetDirId: string) => void
}

/*
  行规格照搬 demo 的 .tree__item：36px 高、9px 圆角、9px 图标间距、
  hover 用 fill-3、当前项用 accent-soft + 半粗、右侧 mono 计数。
*/
const ITEM_CLASS =
  'flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13.5px] leading-snug text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground'

const ITEM_ACTIVE_CLASS = 'bg-accent-soft font-semibold text-primary'

const ITEM_MUTED_CLASS = 'text-text-muted'

/** viewEntries 的 id → 图标（纯展示映射，未知 id 回落到文件夹图标） */
function viewEntryIcon(id: string) {
  if (id === 'favorites') return Star
  if (id === 'collections') return Inbox
  if (id === 'recycle') return Trash2
  return Folder
}

/** 文件夹真实计数：后端 list 会在目录项上带 includeFiles / includeFolders */
function folderCount(folder: FileItem): number | undefined {
  if (folder.includeFiles == null && folder.includeFolders == null) {
    return undefined
  }
  return (folder.includeFiles ?? 0) + (folder.includeFolders ?? 0)
}

function TreeCount({
  value,
  active,
}: {
  value?: number
  active?: boolean
}) {
  if (value == null) return null
  return (
    <span
      className={cn(
        'ml-auto shrink-0 pl-2 font-mono text-[11.5px] tabular-nums',
        active ? 'text-primary' : 'text-text-muted'
      )}
    >
      {value}
    </span>
  )
}

export function FolderTree({
  pathItems,
  subFolders,
  rootActive,
  activePathId,
  onRootClick,
  onPathClick,
  onFolderClick,
  viewEntries,
  rootCount,
  rootFolderId,
  onMove,
  onImportIm,
  onImportMemo,
}: FolderTreeProps) {
  const { t } = useTranslation('files')
  const pathIndent = 10 + Math.min(pathItems.length, 4) * 14

  let stagger = 0
  const nextDelay = () => `${Math.min(stagger++ * 32, 480)}ms`

  return (
    <aside className='fs-tree glass-card hud-corners hidden min-h-0 flex-col gap-1 overflow-y-auto self-start p-2.5 lg:flex'>
      <p className='a-eyebrow px-2.5 pt-1 pb-1.5'>位置</p>

      <ul className='flex flex-col gap-0.5'>
        <li>
          <TreeDropRow
            folderId={rootFolderId}
            onClick={onRootClick}
            title={t('breadcrumb.allFiles')}
            current={rootActive}
            delay={nextDelay()}
            className={cn(ITEM_CLASS, rootActive && ITEM_ACTIVE_CLASS)}
            onMove={onMove}
            onImportIm={onImportIm}
            onImportMemo={onImportMemo}
          >
            <Folder
              className={cn(
                'size-4 shrink-0',
                rootActive ? 'text-primary' : 'text-text-muted'
              )}
              strokeWidth={1.75}
            />
            <span className='min-w-0 truncate'>{t('breadcrumb.allFiles')}</span>
            <TreeCount value={rootCount} active={rootActive} />
          </TreeDropRow>
        </li>

        {pathItems.map((item, index) => (
          <li key={item.id}>
            <TreeDropRow
              folderId={item.id}
              onClick={() => onPathClick(item.id)}
              title={item.name}
              current={activePathId === item.id}
              delay={nextDelay()}
              style={{ paddingLeft: 10 + Math.min(index + 1, 4) * 14 }}
              className={cn(ITEM_CLASS, activePathId === item.id && ITEM_ACTIVE_CLASS)}
              onMove={onMove}
              onImportIm={onImportIm}
              onImportMemo={onImportMemo}
            >
              <Folder
                className={cn(
                  'size-4 shrink-0',
                  activePathId === item.id ? 'text-primary' : 'text-text-muted'
                )}
                strokeWidth={1.75}
              />
              <span className='min-w-0 truncate'>{item.name}</span>
            </TreeDropRow>
          </li>
        ))}

        {subFolders.map((folder) => {
          const count = folderCount(folder)
          return (
            <li key={folder.id}>
              <TreeDropRow
                folderId={folder.id}
                onClick={() => onFolderClick(folder)}
                title={folder.displayName}
                delay={nextDelay()}
                style={{ paddingLeft: pathIndent }}
                className={ITEM_CLASS}
                onMove={onMove}
                onImportIm={onImportIm}
                onImportMemo={onImportMemo}
              >
                <Folder className='size-4 shrink-0 text-text-muted' strokeWidth={1.75} />
                <span className='min-w-0 truncate'>{folder.displayName}</span>
                <TreeCount value={count} />
              </TreeDropRow>
            </li>
          )
        })}
      </ul>

      {viewEntries.length > 0 && (
        <div className='mt-2 border-t border-border/60 pt-2'>
          <ul className='flex flex-col gap-0.5'>
            {viewEntries.map((entry) => {
              const Icon = viewEntryIcon(entry.id)
              return (
                <li key={entry.id}>
                  <button
                    type='button'
                    onClick={entry.onClick}
                    title={entry.label}
                    aria-current={entry.active ? 'true' : undefined}
                    style={{ animationDelay: nextDelay() }}
                    className={cn(
                      'tech-rise',
                      ITEM_CLASS,
                      ITEM_MUTED_CLASS,
                      entry.active && ITEM_ACTIVE_CLASS
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        entry.active ? 'text-primary' : 'text-text-muted'
                      )}
                      strokeWidth={1.75}
                    />
                    <span className='min-w-0 truncate'>{entry.label}</span>
                    <TreeCount value={entry.count} active={entry.active} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}

function acceptsTreeDrop(event: DragEvent) {
  const types = Array.from(event.dataTransfer.types)
  return (
    types.includes(FREEFS_MEMOS_MIME) ||
    types.includes(FREEFS_IM_MESSAGE_MIME) ||
    types.includes('application/json')
  )
}

function TreeDropRow({
  folderId,
  onClick,
  title,
  current,
  delay,
  style,
  className,
  children,
  onMove,
  onImportIm,
  onImportMemo,
}: {
  folderId?: string
  onClick: () => void
  title: string
  current?: boolean
  delay: string
  style?: { paddingLeft?: number }
  className: string
  children: ReactNode
  onMove?: (fileIds: string[], targetDirId: string) => void
  onImportIm?: (item: ImMessageDragItem, targetDirId: string) => void
  onImportMemo?: (memos: WorkspaceMemo[], targetDirId: string) => void
}) {
  const [over, setOver] = useState(false)
  useEffect(() => subscribeDrag((state) => {
    if (!state.kind) setOver(false)
  }), [])

  return (
    <button
      type='button'
      onClick={onClick}
      title={title}
      aria-current={current ? 'true' : undefined}
      style={{ ...style, animationDelay: delay }}
      className={cn('tech-rise', className, over && 'bg-accent-soft text-primary')}
      onDragEnter={(event) => {
        if (!folderId || !acceptsTreeDrop(event)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragOver={(event) => {
        if (!folderId || !acceptsTreeDrop(event)) return
        event.preventDefault()
        event.stopPropagation()
        const types = Array.from(event.dataTransfer.types)
        event.dataTransfer.dropEffect = types.includes('application/json') ? 'move' : 'copy'
        setOver(true)
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setOver(false)
      }}
      onDrop={(event) => {
        if (!folderId) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        const memos = collectMemoDrag(event)
        if (memos.length > 0) {
          onImportMemo?.(memos, folderId)
          playLandBounce(event.currentTarget)
          return
        }
        const chatItem = collectImMessageDrag(event)
        if (chatItem) {
          onImportIm?.(chatItem, folderId)
          playLandBounce(event.currentTarget)
          return
        }
        const raw = event.dataTransfer.getData('application/json')
        if (!raw) return
        try {
          const ids = JSON.parse(raw) as string[]
          if (Array.isArray(ids) && ids.length > 0) {
            onMove?.(ids, folderId)
            playLandBounce(event.currentTarget)
          }
        } catch {
          // ignore
        }
      }}
    >
      {children}
    </button>
  )
}
