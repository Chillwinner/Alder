/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { AxiosRequestConfig } from 'axios'
import { request } from './request'
import type { ImFriend, ImGroup, ImGroupMember, ImHistoryResult, ImInboxItem, ImMessage, ImUserSearchResult } from '@/types/im'

export function fetchImInbox() {
  return request.get<ImInboxItem[]>('/apis/conversation/inbox')
}

export function fetchImUnreadTotal() {
  return request.get<{ total: number }>('/apis/conversation/unread')
}

export function fetchImHistory(
  conversationId: string,
  options?: { afterId?: number; beforeId?: number; limit?: number }
) {
  return request.get<ImHistoryResult>('/apis/conversation/history', {
    params: {
      conversationId,
      afterId: options?.afterId ?? 0,
      beforeId: options?.beforeId ?? 0,
      limit: options?.limit ?? 50,
    },
  })
}

export function sendImMessage(payload: {
  conversationId?: string
  friendId?: string
  clientMsgId: string
  content: string
  msgType?: string
  quoteMessageId?: number
}) {
  return request.post<ImMessage>('/apis/conversation/send', payload)
}

export function recallImMessage(messageId: number) {
  return request.post<ImMessage>('/apis/conversation/recall', { messageId })
}

export function hideImMessage(messageId: number) {
  return request.post<void>('/apis/conversation/hide', { messageId })
}

export function saveImMessageToWorkspace(payload: {
  conversationId: string
  messageId: number
  parentId?: string
}) {
  return request.post<{
    id: string
    displayName?: string
    originalName?: string
    size?: number
    mimeType?: string | null
    isDir?: boolean
    parentId?: string | null
    suffix?: string
  }>('/apis/conversation/media/save-to-workspace', payload, { timeout: 180_000 })
}

export function shareImWorkspaceFile(
  conversationId: string,
  fileId: string,
  config?: AxiosRequestConfig
) {
  return request.post<{
    url?: string | null
    name: string
    size: number
    mime?: string | null
    shareId?: string
    fileId?: string
    isDir?: boolean
  }>(
    '/apis/conversation/media/from-file',
    { conversationId, fileId },
    {
      timeout: 120_000,
      ...config,
    }
  )
}

export function uploadImMessageMedia(
  conversationId: string,
  file: File,
  config?: AxiosRequestConfig
) {
  const formData = new FormData()
  formData.append('conversationId', conversationId)
  formData.append('file', file)
  return request.post<{ url: string; name: string; size: number; mime?: string | null }>(
    '/apis/conversation/media/message',
    formData,
    {
      timeout: 0,
      ...config,
    }
  )
}

export function markImRead(conversationId: string, lastId: number) {
  return request.post<{ total: number }>('/apis/conversation/read', {
    conversationId,
    lastId,
  })
}

export function openSingleConversation(friendId: string) {
  return request.post<{ conversationId: string }>(
    `/apis/conversation/single/open?friendId=${encodeURIComponent(friendId)}`
  )
}

export function fetchFriends() {
  return request.get<ImFriend[]>('/apis/conversation/friends')
}

export function fetchFriendRequests() {
  return request.get<ImFriend[]>('/apis/conversation/friends/requests')
}

export function fetchRejectedFriendRequests() {
  return request.get<ImFriend[]>('/apis/conversation/friends/rejected')
}

export function searchUsers(keyword: string) {
  return request.get<ImUserSearchResult[]>('/apis/conversation/friends/search', {
    params: { keyword },
  })
}

export function requestFriend(friendId: string, remark?: string) {
  return request.post<void>('/apis/conversation/friends/request', { friendId, remark })
}

export function acceptFriend(friendId: string) {
  return request.post<void>(
    `/apis/conversation/friends/accept?friendId=${encodeURIComponent(friendId)}`
  )
}

export function rejectFriend(friendId: string) {
  return request.post<void>(
    `/apis/conversation/friends/reject?friendId=${encodeURIComponent(friendId)}`
  )
}

export function blockFriend(friendId: string) {
  return request.post<void>(
    `/apis/conversation/friends/block?friendId=${encodeURIComponent(friendId)}`
  )
}

export function deleteFriend(friendId: string) {
  return request.post<void>(
    `/apis/conversation/friends/delete?friendId=${encodeURIComponent(friendId)}`
  )
}

export function setConversationMuted(conversationId: string, muted: boolean) {
  return request.post<void>('/apis/conversation/mute', { conversationId, muted })
}

export function fetchImGroupMembers(groupId: string) {
  return request.get<ImGroupMember[]>('/apis/conversation/groups/members', {
    params: { groupId },
  })
}

export function leaveImGroup(groupId: string) {
  return request.post<void>(
    `/apis/conversation/groups/leave?groupId=${encodeURIComponent(groupId)}`
  )
}

export function inviteImGroupMembers(groupId: string, memberIds: string[]) {
  return request.post<{ count: number }>('/apis/conversation/groups/invite', {
    groupId,
    memberIds,
  })
}

export function fetchImGroups() {
  return request.get<ImGroup[]>('/apis/conversation/groups')
}

export function uploadGroupAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<{ path: string }>('/apis/conversation/media/group-avatar', formData, {
    timeout: 0,
  })
}

export function createImGroup(payload: {
  name: string
  avatar?: string
  notice?: string
  memberIds?: string[]
}) {
  return request.post<{ id: string; conversationId: string }>('/apis/conversation/groups', payload)
}

export function updateImGroup(payload: { groupId: string; avatar?: string | null; notice?: string | null }) {
  return request.put<ImGroup>('/apis/conversation/groups', payload)
}
