/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useState } from 'react'
import { invitationApi } from '@/api/invitation'
import type { InvitationDetail } from '@/types/invitation'

const DISMISS_STORAGE_KEY = 'fs:invitation-dock-dismissed-ids'
export const INVITATIONS_CHANGED_EVENT = 'workspace-invitations-changed'

function readDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]))
}

export function dismissInvitationInDock(invitationId: string) {
  const next = readDismissedIds()
  next.add(invitationId)
  writeDismissedIds(next)
}

export function dismissAllInDock(invitationIds: string[]) {
  const next = readDismissedIds()
  for (const id of invitationIds) {
    next.add(id)
  }
  writeDismissedIds(next)
}

export function useWorkspaceInvitations(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [items, setItems] = useState<InvitationDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    readDismissedIds()
  )

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const list = await invitationApi.listMine()
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    void refresh()
    const onChanged = () => void refresh()
    window.addEventListener(INVITATIONS_CHANGED_EVENT, onChanged)
    const timer = window.setInterval(() => void refresh(), 45_000)
    return () => {
      window.removeEventListener(INVITATIONS_CHANGED_EVENT, onChanged)
      window.clearInterval(timer)
    }
  }, [enabled, refresh])

  const dockItems = items.filter((item) => !dismissedIds.has(item.id))

  const dismissInDock = useCallback((invitationId: string) => {
    dismissInvitationInDock(invitationId)
    setDismissedIds(readDismissedIds())
  }, [])

  const dismissAllVisibleInDock = useCallback(() => {
    dismissAllInDock(dockItems.map((item) => item.id))
    setDismissedIds(readDismissedIds())
  }, [dockItems])

  return {
    items,
    dockItems,
    loading,
    refresh,
    dismissedIds,
    dismissInDock,
    dismissAllVisibleInDock,
  }
}

export function notifyInvitationsChanged() {
  window.dispatchEvent(new Event(INVITATIONS_CHANGED_EVENT))
}
