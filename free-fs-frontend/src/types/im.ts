/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export type ImMessage = {
  id: number
  clientMsgId: string
  conversationId: string
  senderId: string
  senderUsername?: string | null
  senderNickname?: string | null
  senderAvatar?: string | null
  content: string
  msgType: string
  createdAt: string
  recalledAt?: string | null
  quoteMessageId?: number | null
  quoteSenderId?: string | null
  quoteSenderName?: string | null
  quoteContent?: string | null
  quoteMsgType?: string | null
  quoteRecalled?: boolean | null
}

export type ImHistoryResult = {
  messages: ImMessage[]
  peerLastReadMessageId?: number | null
}

export type ImInboxItem = {
  conversationId?: string | null
  convType: 'single' | 'group'
  groupId?: string | null
  groupName?: string | null
  peerUserId?: string | null
  peerUsername?: string | null
  peerNickname?: string | null
  peerAvatar?: string | null
  groupAvatar?: string | null
  groupNotice?: string | null
  unreadCount: number
  lastMessageId?: number | null
  lastContent?: string | null
  lastTime?: string | null
  pinned?: boolean
  muted?: boolean
}

export type ImFriend = {
  friendId: string
  username: string
  nickname?: string | null
  avatar?: string | null
  email?: string | null
  remark?: string | null
  status: string
  createdAt: string
}

export type ImGroup = {
  id: string
  name: string
  avatar?: string | null
  ownerId?: string | null
  notice?: string | null
  conversationId: string
  memberCount?: number | null
  createdAt?: string | null
}

export type ImGroupMember = {
  userId: string
  username: string
  nickname?: string | null
  avatar?: string | null
  role: string
  groupNickname?: string | null
  joinedAt?: string | null
  friendStatus?: string | null
}

export type ImUserSearchResult = {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  email?: string | null
  friendStatus?: string | null
}

export type ImPush = {
  type:
    | 'MESSAGE'
    | 'UNREAD'
    | 'READ'
    | 'RECALL'
    | 'FRIEND_REQUEST'
    | 'WORKSPACE_INVITATION'
    | 'FILE_COLLECTION_SUBMISSION'
    | 'FILE_COLLECTION_ASSIGNED'
    | 'WORKSPACE_VOTE'
    | 'WORKSPACE_MEETING'
    | 'WORKSPACE_MEETING_PRE15'
    | 'WORKSPACE_AI_REMINDER'
  userId?: string
  conversationId?: string
  unreadCount?: number
  lastReadMessageId?: number
  message?: ImMessage
}
