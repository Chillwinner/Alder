/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  createWorkspaceMemo,
  deleteWorkspaceMemo,
  getMemoPreviewBody,
  getWorkspaceBoardOverview,
  setFileshareBoardPinned,
  updateWorkspaceMemo,
} from '@/api/workspace-board'
import type {
  MemoVisibility,
  WorkspaceBoardOverview,
  WorkspaceMemo,
} from '@/types/workspace-board'
import type { MemoCollabStatus } from '@/lib/memo-stomp-provider'
import { exportMemoAsMarkdown } from '@/lib/memo-markdown'
import { cancelOwnMemoEvent, expectOwnMemoEvent } from '@/lib/memo-editor-flush'
import { usePersistedMemoScope } from '@/lib/memo-scope'
import { useMemoPreviewStore } from '@/store/memo-preview'
import { useShortcutBindings } from '@/hooks/use-shortcut-bindings'

const MEMO_PAGE_SIZE = 10
const FILE_PAGE_SIZE = 10

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  return {
    slice: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    totalPages,
    page: safePage,
  }
}

export function useWorkspaceBoard() {
  const { t } = useTranslation('board')
  const { slug = '', memoId: routeMemoId } = useParams<{ slug: string; memoId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => ['workspace-board', slug] as const, [slug])

  const [memoScope, setMemoScope] = usePersistedMemoScope(slug, 'private')
  const [memoPage, setMemoPage] = useState(1)
  const [filePage, setFilePage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editMemoId, setEditMemoId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [collabStatus, setCollabStatus] = useState<MemoCollabStatus | ''>('')
  const previewMemo = useMemoPreviewStore((state) => state.memo)
  const [previewContentKey, setPreviewContentKey] = useState(0)

  const { data: overview, isLoading } = useQuery({
    queryKey,
    queryFn: getWorkspaceBoardOverview,
    staleTime: 30_000,
    refetchInterval: 8_000,
  })

  const memos = overview?.memos ?? []
  const scopedMemos = useMemo(
    () =>
      memos.filter((memo) =>
        memoScope === 'private' ? memo.visibility === 'private' : memo.visibility !== 'private'
      ),
    [memoScope, memos]
  )
  const files = overview?.fileshareFiles ?? []
  const memoPagination = useMemo(
    () => paginate(scopedMemos, memoPage, MEMO_PAGE_SIZE),
    [scopedMemos, memoPage]
  )
  const filePagination = useMemo(() => paginate(files, filePage, FILE_PAGE_SIZE), [files, filePage])

  useEffect(() => {
    if (memoPage > memoPagination.totalPages) setMemoPage(memoPagination.totalPages)
  }, [memoPage, memoPagination.totalPages])

  useEffect(() => {
    if (filePage > filePagination.totalPages) setFilePage(filePagination.totalPages)
  }, [filePage, filePagination.totalPages])

  useEffect(() => {
    const onUploaded = () => void queryClient.invalidateQueries({ queryKey })
    window.addEventListener('file-upload-complete', onUploaded)
    window.addEventListener('fileshare-changed', onUploaded)
    return () => {
      window.removeEventListener('file-upload-complete', onUploaded)
      window.removeEventListener('fileshare-changed', onUploaded)
    }
  }, [queryClient, queryKey])

  const openPreview = useCallback((memo: WorkspaceMemo, origin?: DOMRect | null) => {
    useMemoPreviewStore.getState().open(memo, origin ?? null)
  }, [])

  const openEditor = useCallback(
    (memo: WorkspaceMemo) => {
      useMemoPreviewStore.getState().close()
      void queryClient.prefetchQuery({
        queryKey: ['memo-preview-body', memo.id],
        queryFn: () => getMemoPreviewBody(memo.id),
        staleTime: 60_000,
      })
      setEditMemoId(memo.id)
      setEditTitle(memo.title)
      navigate(`/w/${slug}/board/${memo.id}`)
    },
    [navigate, queryClient, slug]
  )

  useEffect(() => {
    if (!routeMemoId) return
    const memo = overview?.memos.find((item) => item.id === routeMemoId)
    setEditMemoId(routeMemoId)
    if (memo) setEditTitle(memo.title)
  }, [overview, routeMemoId])

  const refresh = () => void queryClient.invalidateQueries({ queryKey })

  /*
    拖到侧栏回收站删除备忘录后刷新列表。
    ------------------------------------------------------------------
    Dock 是布局层组件，不该反向依赖备忘录页的 store，所以用 CustomEvent 广播。
    删除会软删备忘录并把 md 丢进文件回收站；从回收站还原文件会一并恢复备忘录。
  */
  useEffect(() => {
    const onTrashDeleted = (event: Event) => {
      const detail = (event as CustomEvent<{ kind: string }>).detail
      if (detail?.kind !== 'memo') return
      refresh()
    }
    window.addEventListener('alder:trash-deleted', onTrashDeleted)
    return () => window.removeEventListener('alder:trash-deleted', onTrashDeleted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, slug])

  const createMutation = useMutation({
    mutationFn: (input: { kind?: 'md' | 'canvas'; visibility?: MemoVisibility }) =>
      createWorkspaceMemo(
        input.kind === 'canvas' ? t('canvas.untitled') : t('defaultMemoTitle'),
        input.visibility === 'shared' ? 'shared' : 'private',
        input.kind
      ),
    onSuccess: (memo) => {
      if (memo.visibility === 'shared' || memo.visibility === 'private') {
        setMemoScope(memo.visibility)
      }
      refresh()
      setMemoPage(1)
      openEditor(memo)
    },
    onError: () => toast.error(t('errors.createFailed')),
  })

  const { matches } = useShortcutBindings()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.matches('input, textarea, select') ||
        target?.isContentEditable
      ) {
        return
      }
      if (!matches(event, 'boardNewMemo')) return
      event.preventDefault()
      createMutation.mutate({ kind: 'md', visibility: memoScope })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createMutation, matches, memoScope])

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; title?: string; pinned?: boolean }) =>
      updateWorkspaceMemo(payload.id, payload),
    onSuccess: refresh,
  })

  const flushEditTitle = useCallback(() => {
    const title = editTitle.trim()
    if (!editMemoId || !title) return
    const memo = (overview?.memos ?? []).find((item) => item.id === editMemoId)
    if (memo && memo.title !== title) {
      updateMutation.mutate({ id: editMemoId, title })
    }
  }, [editMemoId, editTitle, overview?.memos, updateMutation])

  const closeEditor = useCallback(() => {
    flushEditTitle()
    setEditMemoId(null)
    setCollabStatus('')
    navigate(`/w/${slug}/board`)
  }, [flushEditTitle, navigate, slug])

  const finishEditorToPreview = useCallback(() => {
    const id = editMemoId
    if (!id) {
      closeEditor()
      return
    }
    flushEditTitle()
    const base = (overview?.memos ?? []).find((item) => item.id === id)
    const title = editTitle.trim() || base?.title || t('defaultMemoTitle')
    setEditMemoId(null)
    setCollabStatus('')
    navigate(`/w/${slug}/board`)
    if (base) {
      useMemoPreviewStore.getState().open({ ...base, title }, null)
      setPreviewContentKey((k) => k + 1)
    }
  }, [
    closeEditor,
    editMemoId,
    editTitle,
    flushEditTitle,
    overview?.memos,
    navigate,
    slug,
    t,
  ])

  const deleteMutation = useMutation({
    mutationFn: deleteWorkspaceMemo,
    onSuccess: (_, id) => {
      if (editMemoId === id) closeEditor()
      if (useMemoPreviewStore.getState().memo?.id === id) {
        useMemoPreviewStore.getState().close()
      }
      refresh()
    },
    onError: () => toast.error(t('errors.deleteFailed')),
  })

  const filePinMutation = useMutation({
    mutationFn: (payload: { fileId: string; pinned: boolean }) =>
      setFileshareBoardPinned(payload.fileId, payload.pinned),
    onMutate: async ({ fileId, pinned }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<WorkspaceBoardOverview>(queryKey)
      if (previous) {
        const patched = previous.fileshareFiles.map((file) =>
          file.id === fileId ? { ...file, boardPinned: pinned } : file
        )
        queryClient.setQueryData<WorkspaceBoardOverview>(queryKey, {
          ...previous,
          fileshareFiles: [
            ...patched.filter((file) => file.boardPinned),
            ...patched.filter((file) => !file.boardPinned),
          ],
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.error(t('errors.filePinFailed'))
    },
    onSettled: refresh,
  })

  const exportMutation = useMutation({
    mutationFn: exportMemoAsMarkdown,
    onError: () => toast.error(t('errors.exportFailed')),
  })

  const handleTitleBlur = () => {
    flushEditTitle()
  }

  const makePublic = useCallback(async () => {
    if (!editMemoId) return
    expectOwnMemoEvent(editMemoId)
    try {
      const updated = await updateWorkspaceMemo(editMemoId, { visibility: 'shared' })
      queryClient.setQueryData<WorkspaceBoardOverview>(queryKey, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          memos: prev.memos.map((memo) =>
            memo.id === editMemoId
              ? {
                  ...memo,
                  ...updated,
                  kind: updated.kind || memo.kind,
                  visibility: 'shared' as const,
                }
              : memo
          ),
        }
      })
      toast.success(t('editor.madePublic'))
    } catch (error) {
      cancelOwnMemoEvent(editMemoId)
      toast.error(t('errors.updateFailed'))
      throw error
    }
  }, [editMemoId, queryClient, queryKey, t])

  return {
    t,
    slug,
    isLoading,
    overview,
    memos: scopedMemos,
    memoScope,
    setMemoScope: (scope: MemoVisibility) => {
      setMemoScope(scope)
      setMemoPage(1)
    },
    files,
    memoPagination,
    filePagination,
    setMemoPage,
    setFilePage,
    uploadOpen,
    setUploadOpen,
    previewMemo,
    openPreview,
    openEditor,
    closeEditor,
    finishEditorToPreview,
    previewContentKey,
    editMemoId,
    editVisibility:
      overview?.memos.find((item) => item.id === editMemoId)?.visibility ?? memoScope,
    editTitle,
    setEditTitle,
    handleTitleBlur,
    collabStatus,
    setCollabStatus,
    createMutation,
    makePublic,
    deleteMutation,
    updateMutation,
    filePinMutation,
    exportMutation,
  }
}
