/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import { aiApi, streamAiChat, type AiMessageDto, type AiThreadDto } from '@/api/ai'

const MESSAGE_WINDOW = 20

export type AiDockMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type AiDockThread = {
  id: string
  title: string
  updatedAt: number
  messages: AiDockMessage[]
}

type AiDockState = {
  open: boolean
  sending: boolean
  threadsByWorkspace: Record<string, AiDockThread[]>
  activeThreadId: string | null
  draft: string
  openDock: () => void
  closeDock: () => void
  toggleDock: () => void
  setDraft: (value: string) => void
  hydrate: (workspaceId: string) => Promise<void>
  selectThread: (workspaceId: string, threadId: string) => Promise<void>
  createThread: (workspaceId: string) => Promise<void>
  removeThread: (workspaceId: string, threadId: string) => Promise<void>
  sendDraft: (workspaceId: string, text?: string) => Promise<void>
  stopTurn: (workspaceId: string) => Promise<void>
  resendFrom: (workspaceId: string, userMessageId: string, text: string) => Promise<void>
}

let inflight: AbortController | null = null

function isAbort(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

function nid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function trimMessages(messages: AiDockMessage[]) {
  return messages.length > MESSAGE_WINDOW ? messages.slice(-MESSAGE_WINDOW) : messages
}

function fromDto(dto: AiThreadDto, messages: AiDockMessage[] = []): AiDockThread {
  return {
    id: dto.id,
    title: dto.title ?? '',
    updatedAt: dto.updatedAt ?? Date.now(),
    messages,
  }
}

function mapMessages(list: AiMessageDto[]): AiDockMessage[] {
  return list.map((item) => ({
    id: nid(),
    role: item.role,
    text: item.text ?? '',
  }))
}

function patchThread(
  state: AiDockState,
  workspaceId: string,
  threadId: string,
  patch: (thread: AiDockThread) => AiDockThread
): AiDockState {
  const list = (state.threadsByWorkspace[workspaceId] ?? []).map((thread) =>
    thread.id === threadId ? patch(thread) : thread
  )
  return {
    ...state,
    threadsByWorkspace: { ...state.threadsByWorkspace, [workspaceId]: list },
  }
}

export const useAiDockStore = create<AiDockState>((set, get) => ({
  open: false,
  sending: false,
  threadsByWorkspace: {},
  activeThreadId: null,
  draft: '',
  openDock: () => set({ open: true }),
  closeDock: () => set({ open: false }),
  toggleDock: () => set({ open: !get().open }),
  setDraft: (draft) => set({ draft }),
  hydrate: async (workspaceId) => {
    const list = await aiApi.listThreads()
    let threads = (list ?? []).map((item) => fromDto(item))
    if (threads.length === 0) {
      const created = await aiApi.createThread()
      threads = [fromDto(created)]
    }
    const activeId = threads[0].id
    const messages = mapMessages(await aiApi.listMessages(activeId))
    threads[0] = { ...threads[0], messages }
    set({
      activeThreadId: activeId,
      threadsByWorkspace: { ...get().threadsByWorkspace, [workspaceId]: threads },
    })
  },
  selectThread: async (workspaceId, threadId) => {
    set({ activeThreadId: threadId })
    const messages = mapMessages(await aiApi.listMessages(threadId))
    set((state) => patchThread(state, workspaceId, threadId, (thread) => ({ ...thread, messages })))
  },
  createThread: async (workspaceId) => {
    const created = await aiApi.createThread()
    const thread = fromDto(created)
    set((state) => ({
      activeThreadId: thread.id,
      threadsByWorkspace: {
        ...state.threadsByWorkspace,
        [workspaceId]: [thread, ...(state.threadsByWorkspace[workspaceId] ?? [])],
      },
    }))
  },
  removeThread: async (workspaceId, threadId) => {
    await aiApi.deleteThread(threadId)
    const remaining = (get().threadsByWorkspace[workspaceId] ?? []).filter((item) => item.id !== threadId)
    set({
      activeThreadId: remaining[0]?.id ?? null,
      threadsByWorkspace: { ...get().threadsByWorkspace, [workspaceId]: remaining },
    })
    if (remaining[0]) {
      await get().selectThread(workspaceId, remaining[0].id)
    }
  },
  sendDraft: async (workspaceId, override) => {
    const text = (override ?? get().draft).trim()
    if (!text || get().sending) return
    let threadId = get().activeThreadId
    if (!threadId) {
      await get().hydrate(workspaceId)
      threadId = get().activeThreadId
    }
    if (!threadId) return

    const userMsg: AiDockMessage = { id: nid(), role: 'user', text }
    const assistantId = nid()
    inflight?.abort()
    inflight = new AbortController()
    const signal = inflight.signal
    set((state) => {
      const next = patchThread(state, workspaceId, threadId, (thread) => ({
        ...thread,
        title: thread.title || text.slice(0, 24),
        updatedAt: Date.now(),
        messages: trimMessages([
          ...thread.messages,
          userMsg,
          { id: assistantId, role: 'assistant', text: '' },
        ]),
      }))
      return { ...next, draft: override ? state.draft : '', sending: true }
    })

    try {
      await streamAiChat(
        threadId,
        text,
        (token) => {
          set((state) =>
            patchThread(state, workspaceId, threadId, (thread) => ({
              ...thread,
              messages: thread.messages.map((message) =>
                message.id === assistantId ? { ...message, text: message.text + token } : message
              ),
            }))
          )
        },
        signal
      )
    } catch (error) {
      if (isAbort(error)) return
      const reason = error instanceof Error ? error.message : 'chat failed'
      set((state) =>
        patchThread(state, workspaceId, threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === assistantId
              ? { ...message, text: message.text || reason }
              : message
          ),
        }))
      )
    } finally {
      if (inflight?.signal === signal) inflight = null
      set({ sending: false })
    }
  },
  stopTurn: async (workspaceId) => {
    const threadId = get().activeThreadId
    inflight?.abort()
    inflight = null
    if (!threadId) {
      set({ sending: false })
      return
    }
    set((state) => {
      const next = patchThread(state, workspaceId, threadId, (thread) => {
        const messages = [...thread.messages]
        if (messages.at(-1)?.role === 'assistant') messages.pop()
        if (messages.at(-1)?.role === 'user') messages.pop()
        return { ...thread, messages }
      })
      return { ...next, sending: false }
    })
    try {
      await aiApi.dropLastTurn(threadId)
    } catch {
      // local transcript already dropped
    }
  },
  resendFrom: async (workspaceId, userMessageId, text) => {
    const threadId = get().activeThreadId
    const trimmed = text.trim()
    if (!threadId || !trimmed) return
    if (get().sending) await get().stopTurn(workspaceId)
    const thread = (get().threadsByWorkspace[workspaceId] ?? []).find((item) => item.id === threadId)
    if (!thread) return
    const index = thread.messages.findIndex((item) => item.id === userMessageId)
    if (index < 0) return
    const prefix = thread.messages.slice(0, index)
    set((state) =>
      patchThread(state, workspaceId, threadId, (item) => ({ ...item, messages: prefix }))
    )
    await aiApi.replaceMessages(
      threadId,
      prefix.map((item) => ({ role: item.role, text: item.text }))
    )
    await get().sendDraft(workspaceId, trimmed)
  },
}))
