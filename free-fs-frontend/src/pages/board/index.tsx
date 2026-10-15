/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { FolderOpen, NotebookPen, Upload } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { workspaceApi } from '@/api/workspace'
import {
  BoardColumnHeader,
  BoardColumnShell,
} from '@/pages/board/components/board-column-shell'
import { BoardEmpty } from '@/pages/board/components/board-empty'
import { FileshareRow } from '@/pages/board/components/fileshare-row'
import { MemoCard } from '@/pages/board/components/memo-card'
import { NewMemoMenu } from '@/pages/board/components/new-memo-menu'
import { MemoEditDialog } from '@/pages/board/components/memo-edit-dialog'
import { useWorkspaceBoard } from '@/pages/board/hooks/use-workspace-board'
import UploadModal from '@/pages/files/components/UploadModal'
import { useAuth } from '@/contexts/auth-context'
import { UserAvatar } from '@/components/user-avatar'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DropOverlay } from '@/components/drop-overlay'
import { uploadFile } from '@/api/file'
import { isExternalFileDrag, isMemoDrag } from '@/components/messages/im-drop-files'
import { useDragState } from '@/hooks/use-drag-layer'
import { useImExternalFileDrop } from '@/hooks/use-im-external-file-drop'
import { toast } from 'sonner'
import {
  reportMemoSaveFailed,
  useSaveMemoToFolder,
} from '@/hooks/use-save-memo-to-folder'
import { cn } from '@/lib/utils'
import './board-bento.css'

/** 列头右上角的圆形「＋」：demo 的列操作位，行为沿用原来的 handler。 */
const columnPlusClass =
  'grid size-8 shrink-0 place-items-center rounded-full border border-border/50 bg-surface-secondary/70 text-text-secondary backdrop-blur-xl transition-colors hover:border-border hover:bg-surface hover:text-foreground active:scale-95 disabled:opacity-40'

/** 列底部「＋ 添加卡片」形按钮：demo 的内层玻璃行。 */
const columnFootClass =
  'board-inner-row mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border/60 text-[13px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:text-foreground active:scale-[0.99] disabled:opacity-40'

export default function WorkspaceBoardPage() {
  const board = useWorkspaceBoard()
  const { user } = useAuth()
  const { t: tf } = useTranslation('files')
  const { t: tl } = useTranslation('layout')
  const [pendingDelete, setPendingDelete] = useState<WorkspaceMemo | null>(null)
  const queryClient = useQueryClient()
  const fileshareFolderId = board.overview?.fileshareFolderId
  const memosFolderId = board.overview?.memosFolderId
  const { save: saveMemoToFolder } = useSaveMemoToFolder()
  const { isOver: localMdOver, dropProps: localMdDropProps } = useImExternalFileDrop({
    enabled: Boolean(memosFolderId),
    targetId: 'board-memos-column',
    accept: isExternalFileDrag,
    onFiles: (files) => {
      const vaults = files.filter((file) => {
        const name = file.name.toLowerCase()
        return name.endsWith('.md') || name.endsWith('.canvas') || name.endsWith('.arch.json')
      })
      if (!vaults.length) {
        toast.error(board.t('dropMdOnly'))
        return
      }
      if (!memosFolderId) return
      void (async () => {
        try {
          for (const file of vaults) {
            await uploadFile(file, memosFolderId)
          }
          await queryClient.invalidateQueries({ queryKey: ['workspace-board', board.slug] })
          board.setMemoPage(1)
        } catch {
          toast.error(board.t('errors.importMdFailed'))
        }
      })()
    },
  })
  const { kind: dragKind } = useDragState()
  const { isOver: filesDropOver, dropProps: filesDropProps } = useImExternalFileDrop({
    enabled: Boolean(fileshareFolderId),
    targetId: 'board-files-column',
    accept: (event) => isExternalFileDrag(event) || isMemoDrag(event),
    onFiles: (files) => {
      if (!fileshareFolderId || !files.length) return
      void (async () => {
        try {
          for (const file of files) {
            await uploadFile(file, fileshareFolderId)
          }
          await queryClient.invalidateQueries({ queryKey: ['workspace-board', board.slug] })
          board.setFilePage(1)
        } catch {
          toast.error(board.t('errors.uploadFailed'))
        }
      })()
    },
    onMemos: (memos) => {
      if (!fileshareFolderId) return
      void saveMemoToFolder(memos, fileshareFolderId).catch((cause) =>
        reportMemoSaveFailed(cause, tf('index.saveFromBoardFailed'))
      )
    },
  })

  // 纯装饰的只读查询：只为页头成员头像叠与卡片创建者服务，失败即静默降级。
  const { data: memberPage } = useQuery({
    queryKey: ['workspace-members', board.slug, 'board'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 24 }),
    enabled: Boolean(board.slug),
    staleTime: 60_000,
    retry: false,
  })
  const members = memberPage?.records ?? []

  const creatorOf = (memo: WorkspaceMemo) => {
    if (user && memo.createdBy === user.id) {
      const mine = user.nickname?.trim() || user.username?.trim()
      if (mine) return { name: mine, avatar: user.avatar }
    }
    const member = memo.createdBy
      ? members.find((item) => item.userId === memo.createdBy)
      : undefined
    const name = member?.nickname?.trim() || member?.username?.trim()
    return name ? { name, avatar: member?.avatar } : undefined
  }

  const headAvatars = members.length
    ? members.slice(0, 4).map((member) => ({
        id: member.id,
        name: member.nickname?.trim() || member.username?.trim() || '成员',
        avatar: member.avatar,
      }))
    : user
      ? [
          {
            id: user.id,
            name: user.nickname?.trim() || user.username?.trim() || '我',
            avatar: user.avatar,
          },
        ]
      : []

  return (
    <div className='min-h-[100dvh] px-6 py-8 sm:px-8'>
      <div className='a-page mx-auto w-full max-w-[1320px]'>
        <header className='a-phead'>
          <div className='min-w-0'>
            <span className='a-eyebrow'>{board.t('title')}</span>
            <h1>{board.t('memoList')}</h1>
            <p className='a-sub'>{board.t('subtitle')}</p>
          </div>

          <div className='a-phead__right'>
            {headAvatars.length ? (
              <div className='me-1 flex items-center' aria-hidden>
                {headAvatars.map((item, index) => (
                  <UserAvatar
                    key={item.id}
                    name={item.name}
                    avatar={item.avatar}
                    size={30}
                    className={cn(
                      'shrink-0 rounded-full ring-2 ring-[var(--app-bg)]',
                      index > 0 && '-ms-2.5'
                    )}
                    fallbackClassName='bg-surface-secondary text-[11px] font-medium text-text-secondary'
                  />
                ))}
                {members.length > headAvatars.length ? (
                  <span className='-ms-2.5 grid size-[30px] shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[11px] font-medium tabular-nums text-text-secondary ring-2 ring-[var(--app-bg)]'>
                    +{members.length - headAvatars.length}
                  </span>
                ) : null}
              </div>
            ) : null}

            <NewMemoMenu
              className='a-btn a-btn--primary board-new-memo'
              disabled={board.createMutation.isPending}
              label={board.t('newMemo')}
              onCreate={(kind, visibility) => board.createMutation.mutate({ kind, visibility })}
            />
          </div>
        </header>

        <div className='grid w-full min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]'>
          <BoardColumnShell
            dropProps={localMdDropProps}
            overlay={
              <DropOverlay active={localMdOver} label={board.t('dropMdToMemos')} />
            }
            footerPage={board.memoPagination.page}
            footerTotalPages={board.memoPagination.totalPages}
            onPageChange={board.setMemoPage}
            header={
              <div className='shrink-0'>
                <BoardColumnHeader
                  icon={<NotebookPen className='size-4' strokeWidth={2} />}
                  title={board.t('notebook')}
                  count={board.memos.length}
                  action={
                    <NewMemoMenu
                      className={columnPlusClass}
                      disabled={board.createMutation.isPending}
                      onCreate={(kind, visibility) => board.createMutation.mutate({ kind, visibility })}
                    />
                  }
                />
              </div>
            }
          >
            <SegmentedControl
              fill
              className='mb-3'
              value={board.memoScope}
              onChange={board.setMemoScope}
              items={[
                { value: 'shared', label: board.t('visibility.shared') },
                { value: 'private', label: board.t('visibility.private') },
              ]}
            />
            {board.isLoading && (
              <p className='py-12 text-center text-[12.5px] text-text-muted'>
                {board.t('loading')}
              </p>
            )}
            {!board.isLoading && board.memos.length === 0 && (
              <BoardEmpty
                icon={<NotebookPen className='size-6' strokeWidth={1.6} />}
                title={
                  board.memoScope === 'private'
                    ? board.t('emptyPrivateMemos')
                    : board.t('emptyMemos')
                }
                hint={board.t('pickMemo')}
              />
            )}
            <ul className='flex flex-col gap-2.5'>
              {board.memoPagination.slice.map((memo) => (
                <li key={memo.id} className='min-w-0'>
                  <MemoCard
                    memo={memo}
                    creator={creatorOf(memo)}
                    selected={board.previewMemo?.id === memo.id}
                    onSelect={(origin) => board.openPreview(memo, origin)}
                    onEdit={() => board.openEditor(memo)}
                    onExport={() => board.exportMutation.mutate(memo)}
                    onTogglePin={() =>
                      board.updateMutation.mutate({ id: memo.id, pinned: !memo.pinned })
                    }
                    onDelete={() => setPendingDelete(memo)}
                  />
                </li>
              ))}
            </ul>
            <NewMemoMenu
              className={columnFootClass}
              disabled={board.createMutation.isPending}
              label={board.t('newMemo')}
              onCreate={(kind, visibility) => board.createMutation.mutate({ kind, visibility })}
            />
          </BoardColumnShell>

          <BoardColumnShell
            className='min-w-0'
            dropProps={filesDropProps}
            overlay={
              <DropOverlay
                active={filesDropOver}
                label={
                  dragKind === 'memo'
                    ? board.t('dropMemoToFiles')
                    : board.t('dropFilesToFileshare')
                }
              />
            }
            footerPage={board.filePagination.page}
            footerTotalPages={board.filePagination.totalPages}
            onPageChange={board.setFilePage}
            header={
              <BoardColumnHeader
                icon={<FolderOpen className='size-4' strokeWidth={2} />}
                title={board.t('filesColumn')}
                count={board.files.length}
                action={
                  <button
                    type='button'
                    className={columnPlusClass}
                    aria-label={board.t('upload')}
                    title={board.t('upload')}
                    disabled={!board.overview?.fileshareFolderId}
                    onClick={() => board.setUploadOpen(true)}
                  >
                    <Upload className='size-4' strokeWidth={2.2} />
                  </button>
                }
              />
            }
          >
            {!board.isLoading && board.files.length === 0 && (
              <BoardEmpty
                icon={<FolderOpen className='size-6' strokeWidth={1.6} />}
                title={board.t('emptyFileshare')}
              />
            )}
            <ul className='flex min-w-0 flex-col gap-2.5'>
              {board.filePagination.slice.map((file) => (
                <li key={file.id} className='min-w-0'>
                  <FileshareRow
                    file={file}
                    slug={board.slug}
                    previewNavigationFiles={board.files}
                    onTogglePin={() =>
                      board.filePinMutation.mutate({
                        fileId: file.id,
                        pinned: !file.boardPinned,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
            <button
              type='button'
              className={columnFootClass}
              disabled={!board.overview?.fileshareFolderId}
              onClick={() => board.setUploadOpen(true)}
            >
              <Upload className='size-4' strokeWidth={2} />
              {board.t('upload')}
            </button>
          </BoardColumnShell>
        </div>
      </div>


      {board.editMemoId ? (
        <MemoEditDialog
          open
          onOpenChange={(open) => {
            if (!open) board.closeEditor()
          }}
          memoId={board.editMemoId}
          title={board.editTitle}
          onTitleChange={board.setEditTitle}
          onTitleBlur={board.handleTitleBlur}
          collabStatus={board.collabStatus}
          onCollabStatusChange={board.setCollabStatus}
          fileshareFolderId={board.overview?.fileshareFolderId ?? null}
          memosFolderId={board.overview?.memosFolderId ?? null}
          workspaceSlug={board.slug}
          visibility={board.editVisibility}
          kind={board.overview?.memos.find((item) => item.id === board.editMemoId)?.kind}
          onDone={board.finishEditorToPreview}
          onMakePublic={
            board.editVisibility === 'shared' ? undefined : () => board.makePublic()
          }
          onExport={() => {
            const memo = board.overview?.memos.find((item) => item.id === board.editMemoId)
            if (!memo) return
            board.exportMutation.mutate({ ...memo, title: board.editTitle })
          }}
        />
      ) : null}

      <UploadModal
        open={board.uploadOpen}
        onOpenChange={board.setUploadOpen}
        parentId={board.overview?.fileshareFolderId ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        destructive
        isLoading={board.deleteMutation.isPending}
        title={tl('sidebar.trashConfirmMemoTitle')}
        desc={
          <div className='flex flex-col gap-2'>
            <p>{tl('sidebar.trashConfirmMemoDesc')}</p>
            {pendingDelete?.title ? (
              <p className='truncate rounded-lg bg-muted/50 px-2 py-1.5 text-[12.5px]'>
                {pendingDelete.title}
              </p>
            ) : null}
          </div>
        }
        cancelBtnText={tl('sidebar.trashConfirmCancel')}
        confirmText={tl('sidebar.trashConfirmDelete')}
        handleConfirm={() => {
          if (!pendingDelete) return
          board.deleteMutation.mutate(pendingDelete.id, {
            onSettled: () => setPendingDelete(null),
          })
        }}
      />
    </div>
  )
}
