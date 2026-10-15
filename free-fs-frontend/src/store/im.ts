/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import type { WorkspaceFileDragItem } from '@/components/messages/im-drop-files'
import type { PanelRect } from '@/hooks/use-floating-panel'
import { createDetachedChatRect } from '@/utils/im-detached-chat-layout'

export type ImPanel = 'chats' | 'contacts'
export type ImDisplayMode = 'sidebar' | 'popup'

export type DetachedChatWindow = {
  id: string
  conversationId: string
  rect: PanelRect
  zIndex: number
}

export type QueuedImDrop = {
  conversationId: string
  files: File[]
  workspaceFiles: WorkspaceFileDragItem[]
}

const DISPLAY_MODE_KEY = 'im-display-mode-v2'
const SIDEBAR_WIDTH_KEY = 'im-sidebar-width-v2'
export const SIDEBAR_MIN_WIDTH = 320
export const SIDEBAR_MAX_WIDTH = 420
export const SIDEBAR_DEFAULT_WIDTH = 340

const POPUP_LIST_WIDTH_KEY = 'im-popup-list-width'
export const POPUP_LIST_MIN_WIDTH = 180
export const POPUP_LIST_MAX_WIDTH = 420
export const POPUP_LIST_DEFAULT_WIDTH = 288

/**
 * 聊天形态：'popup' = 右下角气泡展开的浮窗；'sidebar' = 右侧常驻面板。
 * 用户在浮窗标题栏里切换，选择会记住。独立小窗口（detached）与这两者并存。
 */
function readDisplayMode(): ImDisplayMode {
  if (typeof window === 'undefined') return 'popup'
  return window.localStorage.getItem(DISPLAY_MODE_KEY) === 'sidebar' ? 'sidebar' : 'popup'
}

function persistDisplayMode(mode: ImDisplayMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DISPLAY_MODE_KEY, mode)
}

function readSidebarWidth() {
  if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH
  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
  if (!Number.isFinite(saved)) return SIDEBAR_DEFAULT_WIDTH
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, saved))
}

function readPopupListWidth() {
  if (typeof window === 'undefined') return POPUP_LIST_DEFAULT_WIDTH
  const saved = Number(localStorage.getItem(POPUP_LIST_WIDTH_KEY))
  if (!Number.isFinite(saved)) return POPUP_LIST_DEFAULT_WIDTH
  return Math.min(POPUP_LIST_MAX_WIDTH, Math.max(POPUP_LIST_MIN_WIDTH, saved))
}

type ImState = {
  unreadTotal: number
  dialogOpen: boolean
  displayMode: ImDisplayMode
  panel: ImPanel
  conversationId: string | null
  createGroupOpen: boolean
  sidebarWidth: number
  popupListWidth: number
  detachedChats: DetachedChatWindow[]
  nextDetachedZIndex: number
  peerReadCursor: Record<string, number>
  queuedDrop: QueuedImDrop | null
  setUnreadTotal: (total: number) => void
  queueDropFiles: (conversationId: string, files: File[]) => void
  queueWorkspaceDrop: (conversationId: string, files: WorkspaceFileDragItem[]) => void
  consumeQueuedDrop: () => QueuedImDrop | null
  applyPeerRead: (conversationId: string, lastReadMessageId: number) => void
  setSidebarWidth: (width: number) => void
  setPopupListWidth: (width: number) => void
  openDialog: (options?: { panel?: ImPanel; conversationId?: string | null }) => void
  closeDialog: () => void
  setPanel: (panel: ImPanel) => void
  selectConversation: (conversationId: string | null) => void
  openCreateGroup: () => void
  closeCreateGroup: () => void
  detachToPopup: () => void
  attachToSidebar: () => void
  openDetachedChat: (conversationId: string, anchor?: { x: number; y: number }) => string | null
  closeDetachedChat: (id: string) => void
  updateDetachedChatRect: (id: string, rect: PanelRect) => void
  focusDetachedChat: (id: string) => void
  dockDetachedChat: (id: string) => void
}

export const useImStore = create<ImState>((set) => ({
  unreadTotal: 0,
  dialogOpen: false,
  displayMode: readDisplayMode(),
  panel: 'chats',
  conversationId: null,
  createGroupOpen: false,
  sidebarWidth: readSidebarWidth(),
  popupListWidth: readPopupListWidth(),
  detachedChats: [],
  nextDetachedZIndex: 70,
  peerReadCursor: {},
  queuedDrop: null,
  setUnreadTotal: (total) => set({ unreadTotal: total }),
  queueDropFiles: (conversationId, files) =>
    set({ queuedDrop: { conversationId, files, workspaceFiles: [] } }),
  queueWorkspaceDrop: (conversationId, workspaceFiles) =>
    set({ queuedDrop: { conversationId, files: [], workspaceFiles } }),
  consumeQueuedDrop: () => {
    const drop = useImStore.getState().queuedDrop
    if (drop) useImStore.setState({ queuedDrop: null })
    return drop
  },
  applyPeerRead: (conversationId, lastReadMessageId) =>
    set((state) => ({
      peerReadCursor: {
        ...state.peerReadCursor,
        [conversationId]: Math.max(state.peerReadCursor[conversationId] ?? 0, lastReadMessageId),
      },
    })),
  setSidebarWidth: (width) => {
    const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next))
    set({ sidebarWidth: next })
  },
  setPopupListWidth: (width) => {
    const next = Math.min(POPUP_LIST_MAX_WIDTH, Math.max(POPUP_LIST_MIN_WIDTH, Math.round(width)))
    localStorage.setItem(POPUP_LIST_WIDTH_KEY, String(next))
    set({ popupListWidth: next })
  },
  openDialog: (options) =>
    set((state) => ({
      dialogOpen: true,
      displayMode: state.displayMode,
      panel: options?.panel ?? state.panel,
      conversationId: options?.conversationId ?? state.conversationId,
    })),
  closeDialog: () => set({ dialogOpen: false }),
  setPanel: (panel) =>
    set((state) => ({
      panel,
      conversationId: panel === 'contacts' ? null : state.conversationId,
    })),
  selectConversation: (conversationId) => {
    if (conversationId) {
      window.dispatchEvent(
        new CustomEvent('im:inbox-read', { detail: { conversationId } })
      )
    }
    set({ conversationId, panel: 'chats' })
  },
  openCreateGroup: () => set({ createGroupOpen: true }),
  closeCreateGroup: () => set({ createGroupOpen: false }),
  detachToPopup: () => {
    persistDisplayMode('popup')
    set({ displayMode: 'popup', dialogOpen: true })
  },
  attachToSidebar: () => {
    persistDisplayMode('sidebar')
    set({ displayMode: 'sidebar', dialogOpen: true })
  },
  openDetachedChat: (conversationId, anchor) => {
    const state = useImStore.getState()
    const existing = state.detachedChats.find((chat) => chat.conversationId === conversationId)
    if (existing) {
      state.focusDetachedChat(existing.id)
      return existing.id
    }
    const id = crypto.randomUUID()
    const zIndex = state.nextDetachedZIndex
    const rect = createDetachedChatRect(anchor, state.detachedChats.length)
    set({
      nextDetachedZIndex: zIndex + 1,
      detachedChats: [...state.detachedChats, { id, conversationId, rect, zIndex }],
    })
    return id
  },
  closeDetachedChat: (id) =>
    set((state) => ({
      detachedChats: state.detachedChats.filter((chat) => chat.id !== id),
    })),
  updateDetachedChatRect: (id, rect) =>
    set((state) => ({
      detachedChats: state.detachedChats.map((chat) => (chat.id === id ? { ...chat, rect } : chat)),
    })),
  focusDetachedChat: (id) =>
    set((state) => {
      const zIndex = state.nextDetachedZIndex
      return {
        nextDetachedZIndex: zIndex + 1,
        detachedChats: state.detachedChats.map((chat) =>
          chat.id === id ? { ...chat, zIndex } : chat
        ),
      }
    }),
  dockDetachedChat: (id) => {
    const chat = useImStore.getState().detachedChats.find((item) => item.id === id)
    if (!chat) return
    set((state) => ({
      detachedChats: state.detachedChats.filter((item) => item.id !== id),
      dialogOpen: true,
      displayMode: state.displayMode,
      panel: 'chats',
      conversationId: chat.conversationId,
    }))
  },
}))
