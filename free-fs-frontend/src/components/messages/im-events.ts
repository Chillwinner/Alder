/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export function notifyInboxRead(conversationId: string) {
  window.dispatchEvent(new CustomEvent('im:inbox-read', { detail: { conversationId } }))
}

export function notifyInboxRefresh() {
  window.dispatchEvent(new CustomEvent('im:inbox-refresh'))
}

export function notifyInboxPreview(detail: {
  conversationId: string
  lastContent: string
  lastTime?: string
}) {
  window.dispatchEvent(new CustomEvent('im:inbox-preview', { detail }))
}

export function notifyUnreadTotalRefresh() {
  window.dispatchEvent(new CustomEvent('im:unread-refresh'))
}

export function notifyImSync() {
  window.dispatchEvent(new CustomEvent('im:sync'))
}

export function notifyImPush(push: import('@/types/im').ImPush) {
  window.dispatchEvent(new CustomEvent('im:push', { detail: push }))
}
