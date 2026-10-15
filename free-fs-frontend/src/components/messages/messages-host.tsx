/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect } from 'react'
import { fetchImUnreadTotal } from '@/api/im'
import { ImCreateGroupDialog } from '@/components/messages/im-create-group-dialog'
import { ImDetachedChatsHost } from '@/components/messages/im-detached-chats-host'
import { MessagesPopup } from '@/components/messages/messages-popup'
import { LanTransferHost } from '@/components/lan/lan-transfer-host'
import '@/components/messages/messages-fx.css'
import { useImRealtimeSync } from '@/hooks/use-im-realtime-sync'
import { useImSocket } from '@/hooks/use-im-socket'
import { useAuth } from '@/contexts/auth-context'
import { useImStore } from '@/store/im'
import { isConversationVisible } from '@/components/messages/im-utils'
import type { ImPush } from '@/types/im'

export function MessagesHost() {
  const { user, isAuthenticated } = useAuth()
  const setUnreadTotal = useImStore((state) => state.setUnreadTotal)
  const imEnabled = Boolean(isAuthenticated && user?.id)

  const refreshUnread = useCallback(async () => {
    try {
      const result = await fetchImUnreadTotal()
      setUnreadTotal(result.total)
    } catch {
      // ignore
    }
  }, [setUnreadTotal])

  useImRealtimeSync(imEnabled)

  useEffect(() => {
    if (imEnabled) {
      void refreshUnread()
    }
  }, [imEnabled, refreshUnread])

  useEffect(() => {
    const onUnreadRefresh = () => void refreshUnread()
    const onFocus = () => void refreshUnread()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshUnread()
      }
    }

    window.addEventListener('im:unread-refresh', onUnreadRefresh)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('im:unread-refresh', onUnreadRefresh)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshUnread])

  const handlePush = useCallback(
    (push: ImPush) => {
      const type = push.type?.toUpperCase()

      if (type === 'READ' && push.conversationId && push.lastReadMessageId != null) {
        const lastId = Number(push.lastReadMessageId)
        if (Number.isFinite(lastId)) {
          useImStore.getState().applyPeerRead(push.conversationId, lastId)
        }
      }

      window.dispatchEvent(new CustomEvent('im:push', { detail: push }))

      if (type === 'UNREAD') {
        void refreshUnread()
        return
      }
      if (type === 'MESSAGE' && !isConversationVisible(push.conversationId)) {
        void refreshUnread()
      }
    },
    [refreshUnread]
  )

  useImSocket({
    enabled: imEnabled,
    onPush: handlePush,
    onLanEvent: (event) => {
      window.dispatchEvent(new CustomEvent('alder:lan-event', { detail: event }))
    },
    onConnected: () => {
      void refreshUnread()
      window.dispatchEvent(new CustomEvent('im:connected'))
    },
  })

  return (
    <>
      <MessagesPopup />
      <ImDetachedChatsHost />
      <ImCreateGroupDialog />
      {imEnabled ? <LanTransferHost /> : null}
    </>
  )
}
