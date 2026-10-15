/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { FileItem } from '@/types/file'

export type MemoVisibility = 'shared' | 'private'
export type MemoKind = 'md' | 'canvas'

export type WorkspaceMemo = {
  id: string
  workspaceId: string
  title: string
  kind?: MemoKind | string
  visibility?: MemoVisibility | string
  pinned?: boolean
  sortOrder?: number
  createdBy?: string
  fileId?: string
  createdAt?: string
  updatedAt?: string
}

export type MemoBody = {
  memoId: string
  visibility?: string
  bodyHtml?: string | null
  bodyMd?: string | null
}

export type WorkspaceBoardOverview = {
  fileshareFolderId: string | null
  memosFolderId?: string | null
  fileshareFiles: FileItem[]
  memos: WorkspaceMemo[]
}

export type MemoMetaEvent = {
  event: 'created' | 'updated' | 'deleted'
  memoId: string
  actorId?: string
  title?: string
  updatedAt?: string
}

export type MemoSyncPayload = {
  memoId: string
  type: 'UPDATE' | 'SNAPSHOT' | 'AWARENESS' | 'JOIN'
  payloadBase64?: string
}

export type MemoYjsState = {
  payloadBase64?: string | null
}
