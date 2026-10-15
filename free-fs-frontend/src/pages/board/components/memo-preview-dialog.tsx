/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Download, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { workspaceApi } from '@/api/workspace'
import { MemoPreviewBody } from '@/pages/board/components/memo-preview-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/auth-context'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DialogWindowChrome,
  dialogChromeTitlePadClass,
  dialogExpandedClass,
} from '@/components/dialog-window-chrome'
import { MessagesPopupResizeHandles } from '@/components/messages/messages-popup-resize-handles'
import { Button } from '@/components/ui/button'
import { useFloatingPanel } from '@/hooks/use-floating-panel'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { resolveMemoCreator } from '@/lib/memo-creator'
import { getAvatarFallback } from '@/utils/avatar'
import { resolveMediaUrl } from '@/utils/media-url'
import { cn } from '@/lib/utils'

function formatMemoUpdatedAt(raw?: string | null) {
  if (!raw) return ''
  return dayjs(raw).format('YYYY/M/D HH:mm')
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memo: WorkspaceMemo
  origin?: DOMRect | null
  previewContentKey?: number
  onEdit: () => void
  onExport?: () => void
}

const PREVIEW_MIN_W = 420
const PREVIEW_MIN_H = 320

function createMemoPreviewRect() {
  const w = Math.min(960, Math.max(PREVIEW_MIN_W, window.innerWidth - 24))
  const h = Math.min(820, Math.max(PREVIEW_MIN_H, Math.round(window.innerHeight * 0.88)))
  const x = Math.round((window.innerWidth - w) / 2)
  const y = Math.max(16, Math.round((window.innerHeight - h) / 2))
  return { x, y, w, h }
}

export function MemoPreviewDialog({
  open,
  onOpenChange,
  memo,
  origin = null,
  previewContentKey = 0,
  onEdit,
  onExport,
}: Props) {
  const { t } = useTranslation(['board', 'home'])
  const { user } = useAuth()
  const { slug = '' } = useParams<{ slug: string }>()
  const [grown, setGrown] = useState(!origin)
  const [moving, setMoving] = useState(Boolean(origin))
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(0)
  const originRef = useRef(origin)
  originRef.current = origin

  useLayoutEffect(() => {
    if (!origin) return
    setClosing(false)
    setGrown(false)
    setMoving(true)
    const frame = requestAnimationFrame(() => setGrown(true))
    const timer = window.setTimeout(() => setMoving(false), 480)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [origin, memo.id])

  const { rect, expanded, bindPanel, startMove, startResize, toggleExpanded } = useFloatingPanel(
    open,
    createMemoPreviewRect,
    { minW: PREVIEW_MIN_W, minH: PREVIEW_MIN_H }
  )

  const requestClose = useCallback(() => {
    if (closing) return
    if (expanded) {
      onOpenChange(false)
      return
    }
    const card = originRef.current
    setClosing(true)
    if (card) {
      setMoving(true)
      setGrown(false)
      closeTimer.current = window.setTimeout(() => onOpenChange(false), 460)
      return
    }
    closeTimer.current = window.setTimeout(() => onOpenChange(false), 200)
  }, [closing, expanded, onOpenChange])

  useLayoutEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const { data: membersPage } = useQuery({
    queryKey: ['workspace-members', slug, 'memo-preview'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 500 }),
    enabled: open && Boolean(slug),
    staleTime: 60_000,
  })

  const creator = useMemo(
    () =>
      resolveMemoCreator(memo, membersPage?.records, user?.id, {
        you: t('home:recentFiles.you'),
        member: t('home:recentFiles.member'),
      }),
    [memo, membersPage?.records, t, user?.id]
  )

  const title =
    memo.title?.trim() || t('board:defaultMemoTitle')
  const updatedLabel = formatMemoUpdatedAt(memo.updatedAt ?? memo.createdAt)

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) requestClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className='pointer-events-none z-[100] bg-transparent' />
        <DialogPrimitive.Content
          ref={bindPanel}
          data-slot='dialog-content'
          className={cn(
            'glass-overlay fixed z-[100] flex flex-col overflow-hidden outline-none',
            !origin &&
              'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            !origin && closing && 'animate-out fade-out-0 zoom-out-95 duration-200',
            expanded ? dialogExpandedClass : 'rounded-xl',
            (!open || closing) && 'pointer-events-none',
            !open && 'invisible'
          )}
          style={
            expanded
              ? undefined
              : {
                  left: !grown && origin ? origin.left : rect.x,
                  top: !grown && origin ? origin.top : rect.y,
                  width: !grown && origin ? origin.width : rect.w,
                  height: !grown && origin ? origin.height : rect.h,
                  borderRadius: !grown && origin ? 20 : 12,
                  transform: 'none',
                  opacity: closing ? 0 : 1,
                  transition: moving
                    ? 'left 460ms cubic-bezier(0.22, 1, 0.36, 1), top 460ms cubic-bezier(0.22, 1, 0.36, 1), width 460ms cubic-bezier(0.22, 1, 0.36, 1), height 460ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease'
                    : undefined,
                }
          }
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogWindowChrome
            expanded={expanded}
            onToggleExpand={toggleExpanded}
            onClose={requestClose}
          />

          <div
            className={cn(
              'tech-rise flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2.5 select-none',
              dialogChromeTitlePadClass,
              expanded ? 'cursor-default' : 'cursor-move'
            )}
            onPointerDown={expanded || closing ? undefined : startMove}
          >
            <div className='flex min-w-0 flex-1 items-center gap-2.5'>
              <Avatar className='size-9 shrink-0 rounded-[10px] ring-1 ring-border/60'>
                <AvatarImage
                  src={resolveMediaUrl(creator.avatar)}
                  alt={creator.name}
                />
                <AvatarFallback className='rounded-[10px] bg-surface-secondary text-xs font-medium text-text-secondary'>
                  {getAvatarFallback(creator.name)}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <DialogTitle className='truncate text-base font-bold tracking-[-0.022em] sm:text-lg'>
                  {title}
                </DialogTitle>
                <p className='mt-0.5 truncate text-[12px] text-text-muted sm:text-xs'>
                  <span className='font-medium text-text-secondary'>
                    {creator.name}
                  </span>
                  {updatedLabel ? (
                    <>
                      <span className='px-1 opacity-50'>·</span>
                      <span className='font-mono tabular-nums'>
                        {t('board:preview.lastUpdated', { time: updatedLabel })}
                      </span>
                    </>
                  ) : null}
                </p>
                <DialogDescription className='sr-only'>
                  {t('board:preview.title')}
                </DialogDescription>
              </div>
            </div>
            {onExport ? (
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-8 shrink-0 gap-1.5 rounded-full border-border/70 bg-card/70 px-3 text-[12.5px] font-medium shadow-xs'
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onExport}
              >
                <Download className='size-3.5' />
                {t('board:memoCard.exportMd')}
              </Button>
            ) : null}
            <Button
              type='button'
              size='sm'
              className='h-8 shrink-0 gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold shadow-sm'
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onOpenChange(false)
                onEdit()
              }}
            >
              <Pencil className='size-3.5' />
              {t('memoCard.edit')}
            </Button>
          </div>

          <div className='relative min-h-0 flex-1'>
            <div
              className='tech-rise flex h-full min-h-0 flex-col overflow-hidden px-3 py-3 sm:px-4'
              style={{ animationDelay: '60ms' }}
            >
              <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-[13px] border border-border/60 bg-surface-secondary/45 px-3 py-3 sm:px-4'>
                <MemoPreviewBody
                  memoId={memo.id}
                  memo={memo}
                  visibility={memo.visibility}
                  contentKey={`${previewContentKey}-${memo.updatedAt ?? memo.createdAt ?? memo.id}`}
                  className='px-1'
                />
              </div>
            </div>
            {!expanded ? (
              <MessagesPopupResizeHandles onResize={startResize} reserveBottomPx={0} />
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
