/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import type { ImPendingUpload } from '@/components/messages/im-pending-upload-row'
import type { ImMessage } from '@/types/im'

export type ImConversationSession = {
  messages: ImMessage[]
  hasMoreOlder: boolean
  initialized: boolean
  pendingUploads: ImPendingUpload[]
  quoting: ImMessage | null
}

const emptySession = (): ImConversationSession => ({
  messages: [],
  hasMoreOlder: true,
  initialized: false,
  pendingUploads: [],
  quoting: null,
})

function mergeMessages(prev: ImMessage[], incoming: ImMessage[]) {
  const next = [...prev]
  for (const message of incoming) {
    const index = next.findIndex((item) => item.id === message.id)
    if (index >= 0) {
      const existing = next[index]
      next[index] =
        !message.quoteMessageId && existing.quoteMessageId
          ? {
              ...message,
              quoteMessageId: existing.quoteMessageId,
              quoteSenderId: existing.quoteSenderId,
              quoteSenderName: existing.quoteSenderName,
              quoteContent: existing.quoteContent,
              quoteMsgType: existing.quoteMsgType,
              quoteRecalled: existing.quoteRecalled,
            }
          : message
    } else {
      next.push(message)
    }
  }
  next.sort((a, b) => a.id - b.id)
  return next
}

type ImSessionState = {
  sessions: Record<string, ImConversationSession>
  session: (conversationId: string) => ImConversationSession
  upsertMessages: (conversationId: string, messages: ImMessage[]) => void
  prependOlder: (conversationId: string, messages: ImMessage[], pageSize: number) => void
  markInitialized: (conversationId: string, hasMoreOlder: boolean) => void
  removeMessage: (conversationId: string, messageId: number) => void
  setQuoting: (conversationId: string, message: ImMessage | null) => void
  addPending: (conversationId: string, upload: ImPendingUpload) => void
  patchPending: (conversationId: string, id: string, patch: Partial<ImPendingUpload>) => void
  removePending: (conversationId: string, id: string) => void
}

export const useImSessionStore = create<ImSessionState>((set, get) => ({
  sessions: {},
  session: (conversationId) => get().sessions[conversationId] ?? emptySession(),
  upsertMessages: (conversationId, messages) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            messages: mergeMessages(current.messages, messages),
          },
        },
      }
    }),
  prependOlder: (conversationId, messages, pageSize) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            messages: mergeMessages(current.messages, messages),
            hasMoreOlder: messages.length >= pageSize,
          },
        },
      }
    }),
  markInitialized: (conversationId, hasMoreOlder) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            initialized: true,
            hasMoreOlder,
          },
        },
      }
    }),
  removeMessage: (conversationId, messageId) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            messages: current.messages.filter((item) => item.id !== messageId),
            quoting: current.quoting?.id === messageId ? null : current.quoting,
          },
        },
      }
    }),
  setQuoting: (conversationId, message) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: { ...current, quoting: message },
        },
      }
    }),
  addPending: (conversationId, upload) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            pendingUploads: [...current.pendingUploads, upload],
          },
        },
      }
    }),
  patchPending: (conversationId, id, patch) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            pendingUploads: current.pendingUploads.map((item) =>
              item.id === id ? { ...item, ...patch } : item
            ),
          },
        },
      }
    }),
  removePending: (conversationId, id) =>
    set((state) => {
      const current = state.sessions[conversationId] ?? emptySession()
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: {
            ...current,
            pendingUploads: current.pendingUploads.filter((item) => item.id !== id),
          },
        },
      }
    }),
}))
