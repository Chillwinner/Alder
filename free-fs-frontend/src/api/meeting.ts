/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export interface WorkspaceMeeting {
  id: string
  workspaceId: string
  workspaceName?: string | null
  workspaceSlug?: string | null
  roomId: string
  title: string
  startsAt: string
  createdBy?: string | null
  creatorName?: string | null
  createdAt?: string | null
  canEnter: boolean
  status?: 'SCHEDULED' | 'OPEN' | 'CLOSED' | string
  host?: boolean
  participantUserIds?: string[]
}

export interface MeetingJoin {
  meetingId: string
  roomId: string
  title: string
  workspaceName?: string | null
  host?: boolean
}

export interface IceServer {
  urls: string[]
  username?: string | null
  credential?: string | null
}

export interface IceConfig {
  iceServers: IceServer[]
}

function workspaceHeaders(workspaceId?: string | null) {
  return workspaceId
    ? { headers: { 'X-Workspace-Id': workspaceId } }
    : undefined
}

export function listWorkspaceMeetings(workspaceId?: string) {
  const id = typeof workspaceId === 'string' ? workspaceId : undefined
  return request.get<WorkspaceMeeting[]>(
    '/apis/workspace-meetings',
    id ? workspaceHeaders(id) : undefined
  )
}

export function listPendingMeetings() {
  return request.get<WorkspaceMeeting[]>('/apis/workspace-meetings/pending')
}

export function createWorkspaceMeeting(
  title: string,
  startsAt: string,
  participantUserIds: string[]
) {
  return request.post<WorkspaceMeeting>('/apis/workspace-meetings', {
    title,
    startsAt,
    participantUserIds,
  })
}

export function inviteWorkspaceMeeting(
  meetingId: string,
  workspaceId: string,
  participantUserIds: string[]
) {
  return request.post<void>(
    `/apis/workspace-meetings/${meetingId}/invite`,
    { participantUserIds },
    workspaceHeaders(workspaceId)
  )
}

export function closeWorkspaceMeeting(meetingId: string, workspaceId: string) {
  return request.post<void>(
    `/apis/workspace-meetings/${meetingId}/close`,
    {},
    workspaceHeaders(workspaceId)
  )
}

export function joinWorkspaceMeeting(meetingId: string, workspaceId: string) {
  return request.post<MeetingJoin>(
    `/apis/workspace-meetings/${meetingId}/join`,
    {},
    workspaceHeaders(workspaceId)
  )
}

export function fetchMeetingIceServers(
  meetingId: string,
  workspaceId: string,
  identity: string
) {
  return request.get<IceConfig>(`/apis/workspace-meetings/${meetingId}/ice-servers`, {
    params: { identity },
    ...workspaceHeaders(workspaceId),
  })
}

export function openMeetingWindow(meetingId: string, workspaceId: string) {
  const url = `/meeting/${meetingId}?ws=${encodeURIComponent(workspaceId)}`
  window.open(url, `meeting-${meetingId}`, 'noopener,noreferrer,width=1280,height=800')
}
