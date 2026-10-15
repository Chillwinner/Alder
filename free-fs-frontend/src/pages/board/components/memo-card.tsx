/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Download, Pencil, Pin, Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  collectMemoDrag,
  isMemoDrag,
  setMemoDragData,
} from '@/components/messages/im-drop-files'
import { useDragSource } from '@/hooks/use-drag-source'
import { enterDropTarget, leaveDropTarget, playLandBounce } from '@/lib/drag-layer'
import { linkMemosOnto } from '@/lib/link-memos'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { fetchMemoListPreview } from '@/lib/memo-preview'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'

type Props = {
  memo: WorkspaceMemo
  selected?: boolean
  /** 由页面统一解析的创建者（只读、可缺省：拿不到成员数据时不渲染头像，布局不塌）。 */
  creator?: { name: string; avatar?: string }
  onSelect?: (origin: DOMRect) => void
  onEdit: () => void
  onExport: () => void
  onTogglePin: () => void
  onDelete: () => void
  className?: string
}

/** demo 卡片的相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / 09-30。 */
function formatMemoTime(raw?: string | null) {
  if (!raw) return '—'
  const at = dayjs(raw)
  if (!at.isValid()) return '—'
  const now = dayjs()
  const minutes = now.diff(at, 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (at.isSame(now, 'day')) return `${now.diff(at, 'hour')} 小时前`
  if (at.isSame(now.subtract(1, 'day'), 'day')) return '昨天'
  if (at.isSame(now, 'year')) return at.format('MM-DD')
  return at.format('YYYY-MM-DD')
}

const chipClass =
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-none'

export function MemoCard({
  memo,
  selected,
  creator,
  onSelect,
  onEdit,
  onExport,
  onTogglePin,
  onDelete,
  className,
}: Props) {
  const { t } = useTranslation('board')
  const queryClient = useQueryClient()
  /* 统一的拖拽源行为：抬起/倾斜 + 可放下描边（见 hooks/use-drag-source.ts） */
  const drag = useDragSource('memo')
  const dropId = `memo-card:${memo.id}`
  const timeLabel = formatMemoTime(memo.updatedAt ?? memo.createdAt)
  const contentKey = memo.updatedAt ?? memo.createdAt ?? memo.id

  const { data: preview, isLoading } = useQuery({
    queryKey: ['memo-list-preview', memo.id, contentKey],
    queryFn: () => fetchMemoListPreview(memo),
    staleTime: 30_000,
    enabled: memo.kind !== 'canvas',
  })

  const snippet = (() => {
    if (isLoading) return '…'
    if (memo.kind === 'canvas') return t('canvas.kind')
    if (!preview) return t('memoCard.previewHintShort')
    if (preview.text) {
      return preview.text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return t('memoCard.previewHintShort')
  })()

  return (
    <article
      data-tilt='row'
      {...drag.bind}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest('[data-memo-card-actions]')) {
          event.preventDefault()
          return
        }
        drag.bind.onDragStart(event, (dt) => setMemoDragData(dt, [memo]))
      }}
      onDragEnter={(event) => {
        if (!isMemoDrag(event)) return
        event.preventDefault()
        enterDropTarget(event, dropId, t('editor.memoDropHint'))
      }}
      onDragOver={(event) => {
        if (!isMemoDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={() => leaveDropTarget(dropId)}
      onDrop={(event) => {
        if (!isMemoDrag(event)) return
        event.preventDefault()
        event.stopPropagation()
        leaveDropTarget(dropId)
        const sources = collectMemoDrag(event).filter((item) => item.id !== memo.id)
        if (!sources.length) return
        const landEl = event.currentTarget
        void linkMemosOnto(memo.id, sources)
          .then((changed) => {
            if (changed) {
              playLandBounce(landEl)
              void queryClient.invalidateQueries({ queryKey: ['workspace-board'] })
              toast.success(t('editor.memoLinked'))
            }
          })
          .catch(() => toast.error(t('editor.memoLinkFailed')))
      }}
      title={t('memoCard.dragToChat')}
      className={cn(
        'board-memo-card board-inner-row group relative min-h-[104px] cursor-grab overflow-hidden rounded-[14px] border border-border/50 bg-card/60 px-3.5 py-3 backdrop-blur-xl transition-colors duration-200 hover:border-border hover:bg-card/80',
        // 拖起时抬起+倾斜、有落点接得住时描边（见 hooks/use-drag-source.ts）
        drag.className,
        memo.pinned && 'border-primary/25',
        selected &&
          'ring-2 ring-primary/45 ring-offset-2 ring-offset-[var(--app-bg)]',
        className
      )}
    >
      {memo.pinned ? (
        <span
          className='pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full bg-primary'
          aria-hidden
        />
      ) : null}

      <div
        role='button'
        tabIndex={0}
        className='flex w-full min-w-0 flex-col text-start'
        onClick={(event) => {
          const card = event.currentTarget.closest('article')
          if (!card || !onSelect) return
          onSelect(card.getBoundingClientRect())
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          const card = event.currentTarget.closest('article')
          if (!card || !onSelect) return
          onSelect(card.getBoundingClientRect())
        }}
      >
        <h3 className='truncate text-[15px] font-semibold leading-snug tracking-[-0.012em] text-foreground'>
          {memo.title}
        </h3>
        <p
          className={cn(
            'mt-1 line-clamp-2 text-[12.5px] leading-relaxed',
            preview?.text ? 'text-text-secondary' : 'text-text-muted'
          )}
        >
          {snippet}
        </p>

        {/* demo 卡片的底部分隔行：作者 / 状态在左，mono 时间贴右 */}
        <div className='mt-2.5 flex min-w-0 items-center gap-1.5 border-t border-divider pt-2.5'>
          {creator ? (
            <UserAvatar
              name={creator.name}
              avatar={creator.avatar}
              size={20}
              className='shrink-0 rounded-full'
              fallbackClassName='bg-surface-3 text-[10px] font-medium text-text-secondary'
            />
          ) : null}
          {creator ? (
            <span className='min-w-0 max-w-[9rem] truncate text-[11.5px] font-medium text-text-secondary'>
              {creator.name}
            </span>
          ) : null}
          {memo.pinned ? (
            <span className={cn(chipClass, 'bg-accent-soft text-primary')}>
              <Pin className='size-3 fill-current' aria-hidden />
              {t('memoCard.pin')}
            </span>
          ) : null}
          <span className='ms-auto shrink-0 pl-2 font-mono text-[11px] tabular-nums text-text-muted'>
            {timeLabel}
          </span>
        </div>
      </div>

      <div
        data-memo-card-actions
        className='absolute top-2 right-2 z-10 flex flex-wrap justify-end gap-1 rounded-full bg-card/95 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
      >
        <Button
          type='button'
          size='sm'
          className='h-7 gap-1 rounded-full bg-primary px-2 text-[11px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90 sm:h-8 sm:px-2.5 sm:text-xs'
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className='size-3.5' strokeWidth={2} />
          {t('memoCard.edit')}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='h-7 gap-1 rounded-full border-border bg-card px-2 text-[11px] font-medium shadow-sm sm:h-8 sm:px-2.5 sm:text-xs'
          onClick={(e) => {
            e.stopPropagation()
            onExport()
          }}
        >
          <Download className='size-3.5' strokeWidth={2} />
          {t('memoCard.exportMd')}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='h-7 rounded-full border-border bg-card px-2 text-[11px] font-medium shadow-sm sm:h-8 sm:px-2.5 sm:text-xs'
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
        >
          {memo.pinned ? t('memoCard.unpin') : t('memoCard.pin')}
        </Button>
        <Button
          type='button'
          size='sm'
          className='h-7 gap-1 rounded-full bg-destructive px-2 text-[11px] font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 sm:h-8 sm:px-2.5 sm:text-xs'
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className='size-3.5' strokeWidth={2} />
          {t('deleteMemo')}
        </Button>
      </div>
    </article>
  )
}
