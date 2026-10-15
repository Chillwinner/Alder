/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export type LanFileMeta = {
  name: string
  relativePath: string
  size: number
}

export type LanSession = {
  id: string
  fromUserId: string
  fromName?: string
  toUserId: string
  toName?: string
  files: LanFileMeta[]
  status: string
  createdAt?: string
}

export function lanHeartbeat() {
  return request.post<void>('/apis/lan/presence')
}

export function lanOnlineMap(userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve({} as Record<string, boolean>)
  return request.get<Record<string, boolean>>('/apis/lan/online', {
    params: { userIds },
    paramsSerializer: { indexes: null },
  })
}

export function createLanSession(toUserId: string, files: LanFileMeta[]) {
  return request.post<LanSession>('/apis/lan/sessions', { toUserId, files })
}

export function acceptLanSession(sessionId: string) {
  return request.post<LanSession>(`/apis/lan/sessions/${sessionId}/accept`)
}

export function rejectLanSession(sessionId: string) {
  return request.post<void>(`/apis/lan/sessions/${sessionId}/reject`)
}

export function cancelLanSession(sessionId: string) {
  return request.post<void>(`/apis/lan/sessions/${sessionId}/cancel`)
}

export function failLanSession(sessionId: string) {
  return request.post<void>(`/apis/lan/sessions/${sessionId}/fail`)
}

export function doneLanSession(sessionId: string) {
  return request.post<void>(`/apis/lan/sessions/${sessionId}/done`)
}

export function signalLanSession(sessionId: string, type: string, payload: string) {
  return request.post<void>(`/apis/lan/sessions/${sessionId}/signal`, { type, payload })
}
