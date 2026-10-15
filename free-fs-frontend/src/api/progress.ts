/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export type ProgressKind = 'DAILY' | 'NORMAL'
export type ProgressStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE'

export interface ProgressAssignee {
  userId: string
  name: string
}

export interface ProgressTask {
  id: string
  workspaceId: string
  title: string
  description?: string | null
  kind: ProgressKind
  status: ProgressStatus
  progress: number
  dueAt?: string | null
  note?: string | null
  createdBy: string
  createdByName?: string
  createdAt?: string
  updatedAt?: string
  assignees: ProgressAssignee[]
  todayDone: boolean
  canSubmit: boolean
  canReview: boolean
  canEdit?: boolean
  canDelete?: boolean
  week?: boolean[]
}

export interface ProgressMonth {
  year: number
  month: number
  people: ProgressAssignee[]
  cells: {
    userId: string
    day: number
    count: number
    approved: boolean
    pending: boolean
    titles: string[]
  }[]
}

export function listProgressTasks(params?: {
  scope?: 'all' | 'mine'
  kind?: string
  status?: string
  keyword?: string
  date?: string
}) {
  return request.get<ProgressTask[]>('/apis/progress/tasks', { params })
}

export function getProgressMonth(year: number, month: number) {
  return request.get<ProgressMonth>('/apis/progress/month', { params: { year, month } })
}

export function createProgressTask(body: {
  title: string
  description?: string
  kind: ProgressKind
  dueAt?: string | null
  assigneeIds: string[]
}) {
  return request.post<ProgressTask>('/apis/progress/tasks', body)
}

export function updateProgressTask(id: string, body: {
  title?: string
  description?: string | null
  kind?: ProgressKind
  status?: ProgressStatus
  progress?: number
  dueAt?: string | null
  note?: string | null
}) {
  return request.put<ProgressTask>(`/apis/progress/tasks/${id}`, body)
}

export function updateProgressStatus(id: string, status: ProgressStatus) {
  return request.put<ProgressTask>(`/apis/progress/tasks/${id}/status`, { status })
}

export function deleteProgressTask(id: string) {
  return request.delete<void>(`/apis/progress/tasks/${id}`)
}

export function submitProgressTask(
  id: string,
  files: File[],
  extra?: {
    progress?: number
    note?: string
    description?: string
    dueAt?: string
    status?: ProgressStatus
    review?: boolean
  }
) {
  const data = new FormData()
  files.forEach((file) => data.append('files', file))
  if (extra?.progress != null) data.append('progress', String(extra.progress))
  if (extra?.note) data.append('note', extra.note)
  if (extra?.description) data.append('description', extra.description)
  if (extra?.dueAt) data.append('dueAt', extra.dueAt)
  if (extra?.status) data.append('status', extra.status)
  if (extra?.review) data.append('review', 'true')
  return request.post<ProgressTask>(`/apis/progress/tasks/${id}/submissions`, data)
}

export function reviewProgressTask(id: string, action: 'approve' | 'reject') {
  return request.post<ProgressTask>(`/apis/progress/tasks/${id}/review`, { action })
}
