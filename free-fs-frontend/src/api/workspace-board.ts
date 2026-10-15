/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'
import type {
  MemoBody,
  MemoVisibility,
  MemoYjsState,
  WorkspaceBoardOverview,
  WorkspaceMemo,
} from '@/types/workspace-board'

export function getWorkspaceBoardOverview() {
  return request.get<WorkspaceBoardOverview>('/apis/workspace-board/overview', {
    timeout: 60_000,
  })
}

export function createWorkspaceMemo(
  title?: string,
  visibility?: MemoVisibility,
  kind?: 'md' | 'canvas'
) {
  return request.post<WorkspaceMemo>('/apis/workspace-board/memos', { title, visibility, kind })
}

export function updateWorkspaceMemo(
  memoId: string,
  body: Partial<Pick<WorkspaceMemo, 'title' | 'pinned' | 'sortOrder' | 'visibility'>>
) {
  return request.put<WorkspaceMemo>(`/apis/workspace-board/memos/${memoId}`, body)
}

export function deleteWorkspaceMemo(memoId: string) {
  return request.delete<void>(`/apis/workspace-board/memos/${memoId}`)
}

export function restoreMemosByFileIds(fileIds: string[]) {
  return request.post<void>('/apis/workspace-board/memos/restore-by-files', fileIds, {
    showErrorMessage: false,
  } as import('axios').AxiosRequestConfig & { showErrorMessage: boolean })
}

export function getMemoYjsState(memoId: string) {
  return request.get<MemoYjsState>(`/apis/workspace-board/memos/${memoId}/yjs-state`, {
    timeout: 0,
  })
}

export function getMemoBody(memoId: string) {
  return request.get<MemoBody>(`/apis/workspace-board/memos/${memoId}/body`, {
    timeout: 0,
  })
}

export function getMemoPreviewBody(memoId: string) {
  return request.get<MemoBody>(`/apis/workspace-board/memos/${memoId}/preview-body`, {
    timeout: 0,
  })
}

export function memoInlineImageUrl(memoId: string, index: number) {
  return `/apis/workspace-board/memos/${memoId}/inline-image/${index}`
}

export function getMemoListPreview(memoId: string) {
  return request.get<{ text?: string }>(`/apis/workspace-board/memos/${memoId}/preview`, {
    timeout: 0,
    showErrorMessage: false,
  } as import('axios').AxiosRequestConfig & { showErrorMessage: boolean })
}

export function lookupMemoByName(name: string) {
  return request.get<WorkspaceMemo>('/apis/workspace-board/memos/lookup', {
    params: { name },
    timeout: 0,
    showErrorMessage: false,
  } as import('axios').AxiosRequestConfig & { showErrorMessage: boolean })
}

export function lookupMemoByFileId(fileId: string) {
  return request.get<WorkspaceMemo>(`/apis/workspace-board/memos/by-file/${fileId}`, {
    timeout: 0,
    showErrorMessage: false,
  } as import('axios').AxiosRequestConfig & { showErrorMessage: boolean })
}

export function probeMemo(memoId: string) {
  return request.get<void>(`/apis/workspace-board/memos/${memoId}/available`, {
    timeout: 0,
    showErrorMessage: false,
  } as import('axios').AxiosRequestConfig & { showErrorMessage: boolean })
}

export function getMemoCanvas(memoId: string) {
  return request.get<{ memoId: string; document?: string }>(
    `/apis/workspace-board/memos/${memoId}/canvas`,
    { timeout: 0 }
  )
}

export function saveMemoCanvas(memoId: string, document: string) {
  return request.put<{ memoId: string; document?: string }>(
    `/apis/workspace-board/memos/${memoId}/canvas`,
    { document },
    { timeout: 0 }
  )
}

export function saveMemoBody(memoId: string, body: { bodyMd?: string; bodyHtml?: string }) {
  return request.put<MemoBody>(`/apis/workspace-board/memos/${memoId}/body`, body, {
    timeout: 0,
  })
}

export function listMemoSnapshots(memoId: string) {
  return request.get<{ id: number; savedAt: string; commitMessage?: string }[]>(
    `/apis/workspace-board/memos/${memoId}/snapshots`
  )
}

export function commitMemoSnapshot(memoId: string, message: string) {
  return request.post<{ id: number; savedAt: string; commitMessage?: string }>(
    `/apis/workspace-board/memos/${memoId}/snapshots`,
    { message }
  )
}

export function restoreMemoSnapshot(memoId: string, snapshotId: number) {
  return request.post<MemoYjsState>(
    `/apis/workspace-board/memos/${memoId}/snapshots/${snapshotId}/restore`
  )
}

export function setFileshareBoardPinned(fileId: string, pinned: boolean) {
  return request.put<void>(
    `/apis/workspace-board/fileshare/files/${fileId}/pinned`,
    { pinned }
  )
}
