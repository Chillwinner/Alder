/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import { MoreHorizontal, Pencil, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { workspaceApi } from '@/api/workspace'
import { createWorkspaceMemo, getWorkspaceBoardOverview } from '@/api/workspace-board'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { NewMemoMenu } from '@/pages/board/components/new-memo-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/auth-context'
import type { WorkspaceMember } from '@/types/workspace'
import type { MemoVisibility, WorkspaceMemo } from '@/types/workspace-board'
import { usePersistedMemoScope } from '@/lib/memo-scope'
import { resolveMemoCreator } from '@/lib/memo-creator'
import { formatFileListDisplayTime } from '@/utils/format'
import { setMemoDragData } from '@/components/messages/im-drop-files'
import { beginDrag, endDrag } from '@/lib/drag-layer'
import { useMemoPreviewStore } from '@/store/memo-preview'

const HOME_MEMO_LIMIT = 6

function sortMemosForHome(memos: WorkspaceMemo[]) {
  return [...memos].sort((a, b) => {
    const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    if (pinDelta !== 0) return pinDelta
    const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
    const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
    return tb - ta
  })
}

function RecentMemosList({
  memos,
  members,
}: {
  memos: WorkspaceMemo[]
  members?: WorkspaceMember[]
}) {
  const { t } = useTranslation(['home', 'board'])
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { slug = '' } = useParams<{ slug: string }>()
  const [memoScope, setMemoScope] = usePersistedMemoScope(slug)
  const createMemo = useMutation({
    mutationFn: (input: { kind: 'md' | 'canvas'; visibility: MemoVisibility }) =>
      createWorkspaceMemo(
        input.kind === 'canvas'
          ? t('board:canvas.untitled')
          : t('board:defaultMemoTitle'),
        input.visibility,
        input.kind
      ),
    onSuccess: (memo) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-board', slug] })
      navigate(`/w/${slug}/board/${memo.id}`)
    },
    onError: () => toast.error(t('board:errors.createFailed')),
  })
  const ownerLabel = (memo: WorkspaceMemo) =>
    resolveMemoCreator(memo, members, user?.id, {
      you: t('home:recentFiles.you'),
      member: t('home:recentFiles.member'),
    }).name

  const openPreview = React.useCallback((memo: WorkspaceMemo, origin?: DOMRect | null) => {
    useMemoPreviewStore.getState().open(memo, origin ?? null)
  }, [])

  const openEditor = React.useCallback(
    (memo: WorkspaceMemo) => {
      useMemoPreviewStore.getState().close()
      navigate(`/w/${slug}/board/${memo.id}`)
    },
    [navigate, slug]
  )

  const previewFromTarget = React.useCallback(
    (memo: WorkspaceMemo, target: EventTarget | null) => {
      const row =
        target instanceof HTMLElement ? target.closest('[data-memo-row]') : null
      openPreview(memo, row?.getBoundingClientRect() ?? null)
    },
    [openPreview]
  )

  const scopedMemos = React.useMemo(
    () =>
      memos
        .filter((memo) =>
          memoScope === 'private'
            ? memo.visibility === 'private'
            : memo.visibility !== 'private'
        )
        .slice(0, HOME_MEMO_LIMIT),
    [memos, memoScope]
  )

  return (
    <>
      <section className='flex h-full flex-col'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <h2 className='text-[15px] font-semibold tracking-tight'>
            {t('home:recentMemos.title')}
          </h2>
          <Link
            to={`/w/${slug}/board`}
            className='text-[13px] font-medium text-text-secondary transition-colors hover:text-foreground'
          >
            {t('home:recentMemos.manageLink')}
          </Link>
        </div>
        <SegmentedControl
          fill
          className='mb-3'
          value={memoScope}
          onChange={setMemoScope}
          items={[
            { value: 'shared', label: t('board:visibility.shared') },
            { value: 'private', label: t('board:visibility.private') },
          ]}
        />

        {scopedMemos.length === 0 ? (
          <Empty key={memoScope} className='hb-memo-scope-list flex-1 py-6 md:py-6'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <StickyNote />
              </EmptyMedia>
              <EmptyTitle className='text-sm font-medium text-muted-foreground'>
                {memoScope === 'private'
                  ? t('home:recentMemos.emptyPrivate')
                  : t('home:recentMemos.empty')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul key={memoScope} className='hb-memo-scope-list'>
            {scopedMemos.map((memo) => {
              const timeRaw = memo.updatedAt ?? memo.createdAt
              const title =
                memo.title?.trim() || t('board:defaultMemoTitle')
              return (
                <li key={memo.id}>
                  <div
                    role='button'
                    tabIndex={0}
                    data-memo-row
                    data-tilt='row'
                    draggable
                    title={t('board:memoCard.dragToChat')}
                    onDragStart={(event) => {
                      if ((event.target as HTMLElement).closest('button')) {
                        event.preventDefault()
                        return
                      }
                      setMemoDragData(event.dataTransfer, [memo])
                      beginDrag(event, 'memo')
                    }}
                    onDragEnd={() => endDrag()}
                    className='group relative flex min-h-[52px] cursor-grab items-center rounded-[8px] px-2 py-2 transition-colors duration-150 hover:bg-surface-hover active:cursor-grabbing'
                    onClick={(event) => previewFromTarget(memo, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        previewFromTarget(memo, event.currentTarget)
                      }
                    }}
                  >
                    <div className='min-w-0 flex-1 pe-1 group-hover:pe-14'>
                      <p
                        className='truncate text-[14px] font-medium text-text-primary'
                        title={title}
                      >
                        {title}
                      </p>
                      <p
                        className='mt-0.5 truncate text-[12px] text-text-muted'
                        title={
                          timeRaw
                            ? `${ownerLabel(memo)} · ${formatFileListDisplayTime(timeRaw)}`
                            : ownerLabel(memo)
                        }
                      >
                        {ownerLabel(memo)}
                        {memo.pinned
                          ? ` · ${t('home:recentMemos.pinned')}`
                          : ''}
                        {timeRaw ? (
                          <span className='font-mono tabular-nums'>
                            {` · ${formatFileListDisplayTime(timeRaw)}`}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className='absolute top-1/2 right-2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
                      <button
                        type='button'
                        className='flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-workspace-bg hover:text-foreground'
                        aria-label={t('board:memoCard.edit')}
                        onClick={(event) => {
                          event.stopPropagation()
                          openEditor(memo)
                        }}
                      >
                        <Pencil className='size-3.5' strokeWidth={1.75} />
                      </button>
                      <button
                        type='button'
                        className='flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-workspace-bg hover:text-foreground'
                        aria-label={t('home:recentMemos.open')}
                        onClick={(event) => {
                          event.stopPropagation()
                          previewFromTarget(memo, event.currentTarget.closest('[data-memo-row]'))
                        }}
                      >
                        <MoreHorizontal className='size-3.5' strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <NewMemoMenu
          className='mt-2 flex h-[52px] w-full shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-border/60 text-[13px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:bg-surface-hover hover:text-foreground active:scale-[0.99] disabled:opacity-40'
          disabled={createMemo.isPending}
          label={t('board:newMemo')}
          onCreate={(kind, visibility) => createMemo.mutate({ kind, visibility })}
        />
      </section>

    </>
  )
}

function ListSkeleton() {
  return (
    <div className='h-full'>
      <Skeleton className='h-5 w-24' />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className='mt-3 h-[52px] w-full rounded-[8px]' />
      ))}
    </div>
  )
}

export function RecentMemosTable() {
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['workspace-board', slug],
    queryFn: getWorkspaceBoardOverview,
    staleTime: 30_000,
  })
  const { data: membersPage } = useQuery({
    queryKey: ['workspace-members', slug, 'home-memos'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 500 }),
    staleTime: 60_000,
  })

  const memos = React.useMemo(
    () => sortMemosForHome(data?.memos ?? []),
    [data?.memos]
  )

  if (isLoading) return <ListSkeleton />
  if (isError) {
    return (
      <div className='h-full py-10 text-center text-[13px] text-text-muted'>
        {t('recentMemos.loadFailed')}
        <Button
          variant='outline'
          size='sm'
          className='mt-3'
          onClick={() => void refetch()}
        >
          {t('recentMemos.retry')}
        </Button>
      </div>
    )
  }

  return <RecentMemosList memos={memos} members={membersPage?.records} />
}
