/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { openSingleConversation, sendImMessage } from '@/api/im'
import type { ImMessageDragItem, WorkspaceFileDragItem } from '@/components/messages/im-drop-files'
import { notifyInboxPreview } from '@/components/messages/im-events'
import { packageMemoExport } from '@/lib/memo-markdown'
import { useImStore } from '@/store/im'
import { useImSessionStore } from '@/store/im-session'
import type { ImInboxItem } from '@/types/im'
import type { WorkspaceMemo } from '@/types/workspace-board'

export async function resolveInboxConversationId(item: ImInboxItem): Promise<string | null> {
  if (item.conversationId) return item.conversationId
  if (item.convType === 'single' && item.peerUserId) {
    const { conversationId } = await openSingleConversation(item.peerUserId)
    return conversationId
  }
  return null
}

export async function selectInboxConversation(item: ImInboxItem) {
  const conversationId = await resolveInboxConversationId(item)
  if (conversationId) {
    useImStore.getState().selectConversation(conversationId)
  }
  return conversationId
}

export async function dropFilesToInboxItem(item: ImInboxItem, files: File[]) {
  const conversationId = await resolveInboxConversationId(item)
  if (!conversationId || files.length === 0) return null
  useImStore.getState().queueDropFiles(conversationId, files)
  useImStore.getState().selectConversation(conversationId)
  return conversationId
}

export async function dropWorkspaceFilesToInboxItem(
  item: ImInboxItem,
  files: WorkspaceFileDragItem[]
) {
  const conversationId = await resolveInboxConversationId(item)
  if (!conversationId || files.length === 0) return null
  useImStore.getState().queueWorkspaceDrop(conversationId, files)
  useImStore.getState().selectConversation(conversationId)
  return conversationId
}

export async function forwardImMessageToConversation(targetId: string, drag: ImMessageDragItem) {
  if (!targetId || targetId === drag.conversationId) return false
  const source = useImSessionStore.getState().session(drag.conversationId)
  const message = source.messages.find((entry) => entry.id === drag.messageId)
  if (!message || message.recalledAt) return false
  const sent = await sendImMessage({
    conversationId: targetId,
    clientMsgId: crypto.randomUUID(),
    content: message.content,
    msgType: message.msgType,
  })
  useImSessionStore.getState().upsertMessages(targetId, [sent])
  notifyInboxPreview({
    conversationId: targetId,
    lastContent: sent.content,
    lastTime: sent.createdAt,
  })
  return true
}

export async function dropImMessageToInboxItem(item: ImInboxItem, drag: ImMessageDragItem) {
  const conversationId = await resolveInboxConversationId(item)
  if (!conversationId) return null
  const sent = await forwardImMessageToConversation(conversationId, drag)
  if (!sent) return null
  useImStore.getState().selectConversation(conversationId)
  return conversationId
}

export async function dropMemosToInboxItem(item: ImInboxItem, memos: WorkspaceMemo[]) {
  const files: File[] = []
  for (const memo of memos) {
    const pack = await packageMemoExport(memo, 'chat')
    files.push(pack.file, ...pack.attachments)
  }
  return dropFilesToInboxItem(item, files)
}
