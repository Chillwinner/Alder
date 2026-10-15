/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useState } from 'react'
import { isConversationVisible } from '@/components/messages/im-utils'
import { fetchImInbox } from '@/api/im'
import type { ImInboxItem, ImPush } from '@/types/im'
import { syncUnreadTotalFromInbox } from '@/utils/im-unread-sync'

export function useImInbox() {
  const [items, setItems] = useState<ImInboxItem[]>([])
  const [loading, setLoading] = useState(true)

  const applyInbox = useCallback((inbox: ImInboxItem[]) => {
    setItems((prev) => {
      const local = new Map(prev.map((item) => [item.conversationId, item]))
      return inbox.map((item) => {
        const cached = local.get(item.conversationId)
        if (
          cached?.lastContent &&
          cached.lastTime &&
          item.lastTime &&
          cached.lastTime > item.lastTime
        ) {
          return { ...item, lastContent: cached.lastContent, lastTime: cached.lastTime }
        }
        return item
      })
    })
  }, [])

  /*
   * 未读总数同步必须放在 effect 里，**不能写在 setItems 的 updater 内部**。
   *
   * React 19 会在渲染期求值 updater，而 syncUnreadTotalFromInbox 会写 zustand
   * （顶栏 MessagesHeaderButton 订阅了 unreadTotal），于是变成
   * 「渲染 A 组件时更新 B 组件」，控制台必现：
   *   Cannot update a component (`MessagesHeaderButton`) while
   *   rendering a different component (`ImConversationList`)
   * 放到 effect 后语义完全等价：items 一变就重算总数，不会漏更新。
   */
  useEffect(() => {
    syncUnreadTotalFromInbox(items)
  }, [items])

  const loadInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      applyInbox(await fetchImInbox())
    } catch {
      if (!silent) {
        applyInbox([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [applyInbox])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  useEffect(() => {
    const onPreview = (event: Event) => {
      const { conversationId, lastContent, lastTime } = (
        event as CustomEvent<{ conversationId: string; lastContent: string; lastTime?: string }>
      ).detail
      setItems((prev) => {
        const next = prev.map((item) =>
          item.conversationId === conversationId
            ? { ...item, lastContent, lastTime: lastTime || new Date().toISOString() }
            : item
        )
        next.sort((a, b) => {
          const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
          if (pinned) return pinned
          return String(b.lastTime || '').localeCompare(String(a.lastTime || ''))
        })
        return next
      })
    }
    const onRead = (event: Event) => {
      const { conversationId } = (event as CustomEvent<{ conversationId: string }>).detail
      // 副作用已移到上面的 effect，这里只做纯 state 计算
      setItems((prev) =>
        prev.map((item) =>
          item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item
        )
      )
    }
    const onPush = (event: Event) => {
      const push = (event as CustomEvent<ImPush>).detail
      const type = push.type?.toUpperCase()
      if (type === 'UNREAD') {
        void loadInbox(true)
        return
      }
      if (type !== 'MESSAGE' && type !== 'RECALL') return

      if (isConversationVisible(push.conversationId)) {
        // 同上：副作用交给 effect
        setItems((prev) =>
          prev.map((item) =>
            item.conversationId === push.conversationId ? { ...item, unreadCount: 0 } : item
          )
        )
        window.setTimeout(() => void loadInbox(true), 300)
        return
      }
      void loadInbox(true)
    }
    const onRefresh = () => void loadInbox(true)
    const onSync = () => void loadInbox(true)
    const onConnected = () => void loadInbox(true)
    window.addEventListener('im:inbox-preview', onPreview)
    window.addEventListener('im:inbox-read', onRead)
    window.addEventListener('im:inbox-refresh', onRefresh)
    window.addEventListener('im:sync', onSync)
    window.addEventListener('im:push', onPush)
    window.addEventListener('im:connected', onConnected)
    return () => {
      window.removeEventListener('im:inbox-preview', onPreview)
      window.removeEventListener('im:inbox-read', onRead)
      window.removeEventListener('im:inbox-refresh', onRefresh)
      window.removeEventListener('im:sync', onSync)
      window.removeEventListener('im:push', onPush)
      window.removeEventListener('im:connected', onConnected)
    }
  }, [loadInbox])

  return { items, loading, reload: loadInbox }
}
