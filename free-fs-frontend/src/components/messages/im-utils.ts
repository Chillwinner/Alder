/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { format, isToday } from 'date-fns'
import { getAppLang } from '@/i18n'
import { useImStore } from '@/store/im'
import type { ImInboxItem, ImMessage } from '@/types/im'
import {
  formatImFileName,
  IM_MSG_FILE,
  IM_MSG_IMAGE,
  normalizeImMsgType,
  parseImMessageMedia,
} from '@/utils/im-message-content'
import { enUS, zhCN, zhHK } from 'date-fns/locale'

export const IM_RECALL_LIMIT_MS = 120_000

export function isImRecalled(message: Pick<ImMessage, 'recalledAt'>) {
  return Boolean(message.recalledAt)
}

export function canRecallImMessage(message: Pick<ImMessage, 'recalledAt' | 'createdAt'>, mine: boolean) {
  if (!mine || isImRecalled(message)) return false
  const created = new Date(message.createdAt).getTime()
  return Number.isFinite(created) && Date.now() - created < IM_RECALL_LIMIT_MS
}

type QuoteLabels = { recalled: string; image: string; file: string }

export function imQuoteSnippet(
  message: Pick<ImMessage, 'content' | 'msgType' | 'recalledAt'>,
  labels: QuoteLabels
) {
  if (isImRecalled(message)) return labels.recalled
  const msgType = normalizeImMsgType(message.msgType)
  if (msgType === IM_MSG_IMAGE) return labels.image
  if (msgType === IM_MSG_FILE) {
    const media = parseImMessageMedia(message.content)
    return media?.name ? `${labels.file} ${formatImFileName(media.name)}` : labels.file
  }
  return message.content
}

export function attachQuoteSnapshot(message: ImMessage, quoted: ImMessage | null): ImMessage {
  if (!quoted || isImRecalled(quoted)) return message
  if (message.quoteSenderName && (message.quoteContent || message.quoteRecalled)) {
    return message
  }
  return {
    ...message,
    quoteMessageId: message.quoteMessageId ?? quoted.id,
    quoteSenderId: message.quoteSenderId ?? quoted.senderId,
    quoteSenderName:
      message.quoteSenderName ??
      (quoted.senderNickname || quoted.senderUsername || quoted.senderId),
    quoteContent: message.quoteContent ?? quoted.content,
    quoteMsgType: message.quoteMsgType ?? quoted.msgType,
    quoteRecalled: message.quoteRecalled ?? false,
  }
}

export function imQuotedSnippet(message: ImMessage, labels: QuoteLabels) {
  if (!message.quoteMessageId) return ''
  if (message.quoteRecalled) return labels.recalled
  return imQuoteSnippet(
    {
      content: message.quoteContent || '',
      msgType: message.quoteMsgType || 'TEXT',
      recalledAt: null,
    },
    labels
  )
}

export function isConversationVisible(conversationId?: string | null) {
  if (!conversationId) return false
  const state = useImStore.getState()
  if (state.dialogOpen && state.conversationId === conversationId) return true
  return state.detachedChats.some((chat) => chat.conversationId === conversationId)
}

export function formatInboxLastContent(raw?: string | null) {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (text.startsWith('{')) {
    const media = parseImMessageMedia(text)
    if (media?.name) return media.name
  }
  return text.replace(/\s+/g, ' ')
}

export function displayConversationTitle(item: ImInboxItem) {
  if (item.convType === 'group') {
    return item.groupName || item.conversationId
  }
  return item.peerNickname || item.peerUsername || item.peerUserId || '—'
}

export function displayUserName(user: {
  nickname?: string | null
  username?: string | null
  friendId?: string
  id?: string
}) {
  return user.nickname || user.username || user.friendId || user.id || '—'
}

export function imDateLocale() {
  const lang = getAppLang()
  if (lang === 'zh-HK') return zhHK
  if (lang === 'en') return enUS
  return zhCN
}

export function formatMessageTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const locale = imDateLocale()
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale })
  }
  const lang = getAppLang()
  if (lang === 'en') {
    return format(date, 'MMM d, HH:mm', { locale })
  }
  return format(date, 'MM月dd日 HH:mm', { locale })
}

/** 消息流日期分隔：今天 / 昨天 / 具体日期（纯展示） */
export function formatImDaySeparator(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const locale = imDateLocale()
  const lang = getAppLang()
  if (isToday(date)) return lang === 'en' ? 'Today' : '今天'
  if (lang === 'en') return format(date, 'MMM d, yyyy', { locale })
  return format(date, 'yyyy年M月d日', { locale })
}

/** 日期分组键（同一天的消息共用同一个 key） */
export function imDayKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return format(date, 'yyyy-MM-dd')
}
