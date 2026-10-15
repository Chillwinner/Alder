/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  commitMemoSnapshot,
  listMemoSnapshots,
  restoreMemoSnapshot,
} from '@/api/workspace-board'
import { translateServerText } from '@/i18n'
import { isCanvasMemo } from '@/lib/memo-canvas'
import { MemoCanvasView } from '@/pages/board/components/memo-canvas-view'
import { MemoLocalEditor } from '@/pages/board/components/memo-local-editor'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DialogWindowChrome,
  dialogChromeTitlePadClass,
  dialogExpandedClass,
} from '@/components/dialog-window-chrome'
import { MessagesPopupResizeHandles } from '@/components/messages/messages-popup-resize-handles'
import { useFloatingPanel } from '@/hooks/use-floating-panel'
import type { MemoCollabStatus } from '@/lib/memo-stomp-provider'
import { flushMemoEditor } from '@/lib/memo-editor-flush'
import { cn } from '@/lib/utils'

const MEMO_EDIT_RECT_KEY = 'memo-edit-window-rect-v1'
const EDIT_MIN_W = 520
const EDIT_MIN_H = 420

function createMemoEditRect() {
  const w = Math.min(960, Math.max(EDIT_MIN_W, window.innerWidth - 48))
  const h = Math.min(820, Math.max(EDIT_MIN_H, Math.round(window.innerHeight * 0.88)))
  const x = Math.round((window.innerWidth - w) / 2)
  const y = Math.max(16, Math.round((window.innerHeight - h) / 2))
  return { x, y, w, h }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memoId: string
  title: string
  onTitleChange: (title: string) => void
  onTitleBlur?: () => void
  collabStatus?: MemoCollabStatus | ''
  onCollabStatusChange?: (status: MemoCollabStatus) => void
  fileshareFolderId?: string | null
  memosFolderId?: string | null
  workspaceSlug?: string
  visibility?: string
  kind?: string
  onDone?: () => void
  onExport?: () => void
  onMakePublic?: () => Promise<void>
}

export function MemoEditDialog({
  open,
  onOpenChange,
  memoId,
  title,
  onTitleChange,
  onTitleBlur,
  collabStatus,
  onCollabStatusChange,
  fileshareFolderId,
  memosFolderId,
  workspaceSlug,
  visibility,
  kind,
  onDone,
  onExport,
  onMakePublic,
}: Props) {
  const { t } = useTranslation('board')
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<
    { id: number; savedAt: string; commitMessage?: string }[]
  >([])
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const submitThen = async (next: () => void) => {
    if (saving) return
    setSaving(true)
    try {
      await flushMemoEditor(memoId)
      next()
    } catch {
      toast.error(t('errors.updateFailed'))
      setSaving(false)
    }
  }
  const refreshSnapshots = () =>
    listMemoSnapshots(memoId)
      .then(setSnapshots)
      .catch(() => setSnapshots([]))

  useEffect(() => {
    if (!open || !historyOpen || !memoId) return
    void refreshSnapshots()
  }, [open, historyOpen, memoId])

  const handleCommit = async () => {
    const message = commitMessage.trim()
    if (!message) {
      toast.warning(t('editor.historyMessageRequired'))
      return
    }
    if (committing) return
    setCommitting(true)
    try {
      await flushMemoEditor(memoId)
      await commitMemoSnapshot(memoId, message)
      setCommitMessage('')
      toast.success(t('editor.historyCommitted'))
      await refreshSnapshots()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? translateServerText(error.message, t('editor.historyFailed'))
          : t('editor.historyFailed')
      )
    } finally {
      setCommitting(false)
    }
  }

  const handleRestore = async (snapshotId: number) => {
    try {
      await flushMemoEditor(memoId)
      await restoreMemoSnapshot(memoId, snapshotId)
      setEditorEpoch((n) => n + 1)
      setHistoryOpen(false)
      toast.success(t('editor.historyRestored'))
    } catch {
      toast.error(t('editor.historyFailed'))
    }
  }

  const { rect, expanded, bindPanel, startMove, startResize, toggleExpanded } = useFloatingPanel(
    open,
    createMemoEditRect,
    { minW: EDIT_MIN_W, minH: EDIT_MIN_H, persistKey: MEMO_EDIT_RECT_KEY }
  )

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true)
          return
        }
        void submitThen(() => onOpenChange(false))
      }}
    >
      <DialogPortal>
        <DialogOverlay className='pointer-events-none bg-transparent' />
        <DialogPrimitive.Content
          ref={bindPanel}
          data-slot='dialog-content'
          className={cn(
            'glass-overlay fixed z-50 flex flex-col overflow-hidden outline-none transition-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
            expanded ? dialogExpandedClass : 'rounded-xl',
            !open && 'pointer-events-none invisible'
          )}
          style={
            expanded
              ? undefined
              : {
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  transform: 'none',
                }
          }
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogWindowChrome
            expanded={expanded}
            onToggleExpand={toggleExpanded}
            onClose={() => void submitThen(() => onOpenChange(false))}
          />

          <div
            className={cn(
              'tech-rise flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border/50 px-3 py-2.5 select-none',
              dialogChromeTitlePadClass,
              expanded ? 'cursor-default' : 'cursor-move'
            )}
            onPointerDown={expanded ? undefined : startMove}
          >
            <DialogTitle className='sr-only'>{t('memoCard.edit')}</DialogTitle>
            <DialogDescription className='sr-only'>{t('memoCard.edit')}</DialogDescription>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => onTitleBlur?.()}
              onPointerDown={(e) => e.stopPropagation()}
              className='h-10 min-w-[12rem] flex-1 rounded-lg border-transparent bg-transparent px-2 text-lg font-bold tracking-[-0.022em] shadow-none hover:bg-surface-secondary/60 focus-visible:border-transparent focus-visible:ring-0 sm:max-w-xl'
            />
            {visibility !== 'shared' && onMakePublic ? (
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-8 shrink-0 rounded-full border-border/70 bg-card/70 px-3 text-[12.5px] font-medium shadow-xs'
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => void onMakePublic()}
              >
                {t('editor.makePublic')}
              </Button>
            ) : null}
            <Button
              type='button'
              size='sm'
              variant={historyOpen ? 'secondary' : 'outline'}
              className='h-8 shrink-0 gap-1.5 rounded-full border-border/70 bg-card/70 px-3 text-[12.5px] font-medium shadow-xs'
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setHistoryOpen((openHistory) => !openHistory)}
            >
              <History className='size-3.5' />
              {t('editor.history')}
            </Button>
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
                {t('memoCard.exportMd')}
              </Button>
            ) : null}
            {onDone ? (
              <Button
                type='button'
                size='sm'
                className='ms-auto h-8 shrink-0 gap-1.5 rounded-full px-4 text-[12.5px] font-semibold shadow-sm'
                disabled={saving}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => void submitThen(() => onDone?.())}
              >
                {t('editor.done')}
              </Button>
            ) : null}
          </div>

          <div className='relative min-h-0 flex-1'>
            <div
              className='tech-rise flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4'
              style={{ animationDelay: '60ms' }}
            >
              {historyOpen ? (
                <div className='mb-3 rounded-lg border border-border bg-surface-secondary/70 p-2'>
                  <div
                    className='mb-2 flex gap-2'
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Input
                      value={commitMessage}
                      maxLength={200}
                      placeholder={t('editor.historyMessagePlaceholder')}
                      className='h-8 text-[12.5px]'
                      onChange={(event) => setCommitMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleCommit()
                        }
                      }}
                    />
                    <Button
                      type='button'
                      size='sm'
                      className='h-8 shrink-0 px-3 text-[12.5px]'
                      disabled={committing}
                      onClick={() => void handleCommit()}
                    >
                      {t('editor.historyCommit')}
                    </Button>
                  </div>
                  <div className='max-h-40 overflow-auto'>
                    {snapshots.length === 0 ? (
                      <p className='px-2 py-3 text-[12.5px] text-muted-foreground'>
                        {t('editor.historyEmpty')}
                      </p>
                    ) : (
                      snapshots.map((snap) => (
                        <button
                          key={snap.id}
                          type='button'
                          className='flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-hover'
                          onClick={() => void handleRestore(snap.id)}
                        >
                          <span className='min-w-0'>
                            <span className='block truncate text-[13px] font-medium text-foreground'>
                              {snap.commitMessage || t('editor.history')}
                            </span>
                            <span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
                              {snap.savedAt}
                            </span>
                          </span>
                          <span className='shrink-0 pt-0.5 text-[12px] text-muted-foreground'>
                            {t('editor.historyRestore')}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              {isCanvasMemo({ kind }) ? (
                <MemoCanvasView
                  key={`${memoId}-${editorEpoch}`}
                  memoId={memoId}
                  visibility={visibility}
                  className='min-h-0 flex-1'
                />
              ) : (
                <MemoLocalEditor
                  key={`${memoId}-${editorEpoch}`}
                  memoId={memoId}
                  fileshareFolderId={fileshareFolderId}
                  memosFolderId={memosFolderId}
                  workspaceSlug={workspaceSlug}
                  className='flex min-h-0 flex-1 flex-col overflow-hidden'
                />
              )}
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
