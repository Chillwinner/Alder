/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from '@/api/request'
import { getCurrentWorkspaceId } from '@/store/workspace'

export type AiThreadDto = {
  id: string
  title: string
  updatedAt: number
}

export type AiMessageDto = {
  role: 'user' | 'assistant'
  text: string
}

export type WorkspaceAiSettingsDto = {
  enabled: boolean
  baseUrl: string
  modelName: string
  customPrompt: string
  apiKeyConfigured: boolean
  apiKeyMasked: string
  usingWorkspaceKey: boolean
  canEdit: boolean
}

export type WorkspaceAiRagFileDto = {
  fileId: string
  displayName: string
  size?: number | null
  indexed: boolean
  chunkCount?: number | null
}

export type UpdateWorkspaceAiSettingsPayload = {
  enabled: boolean
  baseUrl: string
  modelName: string
  customPrompt: string
  apiKey?: string
  clearApiKey?: boolean
}

export type AiReminderInboxDto = {
  id: string
  reminderId: string
  workspaceId: string
  workspaceName?: string | null
  message: string
  firedAt: string
}

export const aiApi = {
  listReminderInbox: () => request.get<AiReminderInboxDto[]>('/apis/ai/reminders/inbox'),
  dismissReminderInbox: (inboxId: string) =>
    request.post(`/apis/ai/reminders/inbox/${inboxId}/dismiss`),
  getSettings: () => request.get<WorkspaceAiSettingsDto>('/apis/ai/settings'),
  saveSettings: (payload: UpdateWorkspaceAiSettingsPayload) =>
    request.put<WorkspaceAiSettingsDto>('/apis/ai/settings', payload),
  listRagStaging: () => request.get<WorkspaceAiRagFileDto[]>('/apis/ai/rag/staging'),
  uploadRagStaging: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request.post<WorkspaceAiRagFileDto[]>('/apis/ai/rag/staging/upload', formData, {
      timeout: 0,
    })
  },
  listRagDocs: () => request.get<WorkspaceAiRagFileDto[]>('/apis/ai/rag/docs'),
  indexRag: (fileIds: string[]) =>
    request.post<WorkspaceAiRagFileDto[]>('/apis/ai/rag/index', { fileIds }),
  reindexRag: (fileId: string) =>
    request.post<WorkspaceAiRagFileDto[]>(`/apis/ai/rag/docs/${fileId}/reindex`),
  removeRag: (fileId: string) => request.delete(`/apis/ai/rag/docs/${fileId}`),
  listThreads: () => request.get<AiThreadDto[]>('/apis/ai/threads'),
  createThread: () => request.post<AiThreadDto>('/apis/ai/threads'),
  deleteThread: (threadId: string) => request.delete(`/apis/ai/threads/${threadId}`),
  listMessages: (threadId: string) =>
    request.get<AiMessageDto[]>(`/apis/ai/threads/${threadId}/messages`),
  replaceMessages: (threadId: string, messages: AiMessageDto[]) =>
    request.put(`/apis/ai/threads/${threadId}/messages`, messages),
  dropLastTurn: (threadId: string) =>
    request.post(`/apis/ai/threads/${threadId}/drop-last-turn`),
  officeLock: (fileId: string) =>
    request.get<OfficeLockDto>(`/apis/ai/office/${fileId}/lock`),
  acquireOfficeLock: (fileId: string) =>
    request.post<OfficeLockDto>(`/apis/ai/office/${fileId}/lock`),
  heartbeatOfficeLock: (fileId: string, sessionId: string) =>
    request.post(`/apis/ai/office/${fileId}/heartbeat`, null, { params: { sessionId } }),
  releaseOfficeLock: (fileId: string, sessionId: string) =>
    request.delete(`/apis/ai/office/${fileId}/lock`, { params: { sessionId } }),
  officeThreads: (fileId: string) =>
    request.get<AiThreadDto[]>(`/apis/ai/office/${fileId}/threads`),
  createOfficeThread: (fileId: string) =>
    request.post<AiThreadDto>(`/apis/ai/office/${fileId}/threads`),
  deleteOfficeThread: (fileId: string, threadId: string) =>
    request.delete(`/apis/ai/office/${fileId}/threads/${threadId}`),
  officeMessages: (fileId: string, threadId: string) =>
    request.get<AiMessageDto[]>(`/apis/ai/office/${fileId}/threads/${threadId}/messages`),
  replaceOfficeMessages: (fileId: string, threadId: string, messages: AiMessageDto[]) =>
    request.put(`/apis/ai/office/${fileId}/threads/${threadId}/messages`, messages),
  dropOfficeLastTurn: (fileId: string, threadId: string) =>
    request.post(`/apis/ai/office/${fileId}/threads/${threadId}/drop-last-turn`),
}

/** 服务端写成 `data:` 紧贴正文，没有协议空格。这里不能再裁掉开头空格。 */
function sseField(line: string) {
  return line.slice(5)
}

export type OfficeLockDto = {
  fileId: string
  displayName: string
  suffix: string
  sessionId?: string | null
  lockedByMe: boolean
  holderUserId?: string | null
  revision: number
  officeCliReady: boolean
  threadId: string
}

export async function streamAiChat(
  threadId: string,
  message: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }
  const workspaceId = getCurrentWorkspaceId()
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId

  const response = await fetch(`/apis/ai/threads/${threadId}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ message }),
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(response.statusText || 'chat failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const block of parts) {
      let event = 'message'
      const dataLines: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(sseField(line))
      }
      const data = dataLines.join('\n')
      if (event === 'error') throw new Error(data || 'chat error')
      if (data) onToken(data)
    }
  }
}

export async function streamOfficeAiChat(
  fileId: string,
  threadId: string,
  sessionId: string,
  message: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
) {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
  }
  const workspaceId = getCurrentWorkspaceId()
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId

  const response = await fetch(
    `/apis/ai/office/${fileId}/threads/${threadId}/chat?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ message }),
      signal,
    }
  )
  if (!response.ok || !response.body) {
    throw new Error(response.statusText || 'chat failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const block of parts) {
      let event = 'message'
      const dataLines: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) dataLines.push(sseField(line))
      }
      const data = dataLines.join('\n')
      if (event === 'error') throw new Error(data || 'chat error')
      if (data) onToken(data)
    }
  }
}
