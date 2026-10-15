/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { aiApi, type AiReminderInboxDto } from '@/api/ai'
import { getAssignedFileCollections, getFileCollectionPage, getFileCollectionSubmissions } from '@/api/collection'
import { userApi } from '@/api/user'
import { useAuth } from '@/contexts/auth-context'
import { fetchFriendRequests } from '@/api/im'
import { invitationApi } from '@/api/invitation'
import { listPendingMeetings, type WorkspaceMeeting } from '@/api/meeting'
import { listPendingVotes, type WorkspaceVote } from '@/api/vote'
import {
  INVITATIONS_CHANGED_EVENT,
  notifyInvitationsChanged,
} from '@/hooks/use-workspace-invitations'
import type { FileCollection, FileCollectionSubmission } from '@/types/collection'
import type { ImFriend } from '@/types/im'
import type { InvitationDetail } from '@/types/invitation'

export const HEADER_NOTIFICATIONS_CHANGED = 'header-notifications-changed'

const HEADER_PUSH_TYPES = new Set([
  'FRIEND_REQUEST',
  'WORKSPACE_INVITATION',
  'FILE_COLLECTION_SUBMISSION',
  'FILE_COLLECTION_ASSIGNED',
  'WORKSPACE_VOTE',
  'WORKSPACE_MEETING',
  'WORKSPACE_MEETING_PRE15',
  'WORKSPACE_AI_REMINDER',
])

const HIDDEN_KEY = 'header-notif-hidden-v1'

function storageKey(userId?: string | null) {
  return userId ? `${HIDDEN_KEY}:${userId}` : HIDDEN_KEY
}

function readHiddenKeys(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId)) ?? (userId ? localStorage.getItem(HIDDEN_KEY) : null)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function writeHiddenKeys(keys: Set<string>, userId?: string | null) {
  localStorage.setItem(storageKey(userId), JSON.stringify([...keys]))
}

export type CollectionSubmissionAlert = {
  collectionId: string
  collectionName: string
  submission: FileCollectionSubmission
}

export function useHeaderNotifications(enabled: boolean) {
  const { user } = useAuth()
  const userId = user?.id
  const [friendRequests, setFriendRequests] = useState<ImFriend[]>([])
  const [invitations, setInvitations] = useState<InvitationDetail[]>([])
  const [collectionAlerts, setCollectionAlerts] = useState<
    CollectionSubmissionAlert[]
  >([])
  const [collectionRequests, setCollectionRequests] = useState<FileCollection[]>([])
  const [pendingVotes, setPendingVotes] = useState<WorkspaceVote[]>([])
  const [pendingMeetings, setPendingMeetings] = useState<WorkspaceMeeting[]>([])
  const [reminderInbox, setReminderInbox] = useState<AiReminderInboxDto[]>([])
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => readHiddenKeys(userId))
  const [loading, setLoading] = useState(false)

  const persistHidden = useCallback(
    (next: Set<string>) => {
      writeHiddenKeys(next, userId)
      if (userId) {
        void userApi.saveNotificationHidden([...next]).catch(() => undefined)
      }
    },
    [userId]
  )

  const hideItem = useCallback((key: string) => {
    setHiddenKeys((current) => {
      const next = new Set(current)
      next.add(key)
      persistHidden(next)
      return next
    })
  }, [persistHidden])

  const hideItems = useCallback((keys: string[]) => {
    if (!keys.length) return
    setHiddenKeys((current) => {
      const next = new Set(current)
      for (const key of keys) next.add(key)
      persistHidden(next)
      return next
    })
  }, [persistHidden])

  useEffect(() => {
    if (!enabled || !userId) return
    setHiddenKeys(readHiddenKeys(userId))
    void userApi
      .listNotificationHidden()
      .then((remote) => {
        if (!Array.isArray(remote)) return
        setHiddenKeys((current) => {
          const next = new Set(current)
          for (const key of remote) next.add(key)
          writeHiddenKeys(next, userId)
          return next
        })
      })
      .catch(() => undefined)
  }, [enabled, userId])

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [requests, invites, collectionPage, assigned, votes, meetings, reminders] = await Promise.all([
        fetchFriendRequests().catch(() => [] as ImFriend[]),
        invitationApi.listMine().catch(() => [] as InvitationDetail[]),
        getFileCollectionPage({ page: 1, pageSize: 15 }).catch(() => ({
          records: [] as FileCollection[],
          total: 0,
        })),
        getAssignedFileCollections().catch(() => [] as FileCollection[]),
        listPendingVotes().catch(() => [] as WorkspaceVote[]),
        listPendingMeetings().catch(() => [] as WorkspaceMeeting[]),
        aiApi.listReminderInbox().catch(() => [] as AiReminderInboxDto[]),
      ])
      setFriendRequests(requests)
      setInvitations(invites)
      setCollectionRequests(Array.isArray(assigned) ? assigned : [])
      setPendingVotes(Array.isArray(votes) ? votes : [])
      setPendingMeetings(Array.isArray(meetings) ? meetings : [])
      setReminderInbox(Array.isArray(reminders) ? reminders : [])

      const activeCollections = collectionPage.records
        .filter((c) => c.submissionCount > 0)
        .slice(0, 4)
      const submissionGroups = await Promise.all(
        activeCollections.map(async (collection) => {
          const page = await getFileCollectionSubmissions(collection.id, {
            page: 1,
            pageSize: 2,
          }).catch(() => ({ records: [] as FileCollectionSubmission[], total: 0 }))
          return page.records.map((submission) => ({
            collectionId: collection.id,
            collectionName: collection.collectionName,
            submission,
          }))
        })
      )
      const merged = submissionGroups
        .flat()
        .sort(
          (a, b) =>
            new Date(b.submission.createdAt).getTime() -
            new Date(a.submission.createdAt).getTime()
        )
        .slice(0, 8)
      setCollectionAlerts(merged)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    void refresh()
    const onChanged = () => void refresh()
    const onImPush = (event: Event) => {
      const push = (event as CustomEvent<{ type?: string }>).detail
      const type = push?.type?.toUpperCase()
      if (type && HEADER_PUSH_TYPES.has(type)) {
        if (type === 'WORKSPACE_INVITATION') {
          notifyInvitationsChanged()
        }
        void refresh()
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }
    window.addEventListener(INVITATIONS_CHANGED_EVENT, onChanged)
    window.addEventListener(HEADER_NOTIFICATIONS_CHANGED, onChanged)
    window.addEventListener('im:push', onImPush)
    window.addEventListener('im:connected', onChanged)
    window.addEventListener('focus', onChanged)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => {
      window.removeEventListener(INVITATIONS_CHANGED_EVENT, onChanged)
      window.removeEventListener(HEADER_NOTIFICATIONS_CHANGED, onChanged)
      window.removeEventListener('im:push', onImPush)
      window.removeEventListener('im:connected', onChanged)
      window.removeEventListener('focus', onChanged)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [enabled, refresh])

  const visibleFriendRequests = useMemo(
    () => friendRequests.filter((item) => !hiddenKeys.has(`friend:${item.friendId}`)),
    [friendRequests, hiddenKeys]
  )
  const visibleInvitations = useMemo(
    () => invitations.filter((item) => !hiddenKeys.has(`invite:${item.id}`)),
    [hiddenKeys, invitations]
  )
  const visibleCollectionRequests = useMemo(
    () => collectionRequests.filter((item) => !hiddenKeys.has(`collection-ask:${item.id}`)),
    [collectionRequests, hiddenKeys]
  )
  const visibleCollectionAlerts = useMemo(
    () =>
      collectionAlerts.filter(
        (item) => !hiddenKeys.has(`collection:${item.collectionId}:${item.submission.id}`)
      ),
    [collectionAlerts, hiddenKeys]
  )
  const visibleVotes = useMemo(
    () =>
      pendingVotes.filter(
        (vote) => !hiddenKeys.has(`vote:${vote.id}`)
      ),
    [hiddenKeys, pendingVotes]
  )
  const visibleMeetings = useMemo(
    () =>
      pendingMeetings.filter(
        (meeting) =>
          !hiddenKeys.has(`meeting:${meeting.id}`)
      ),
    [hiddenKeys, pendingMeetings]
  )
  const visibleReminders = useMemo(
    () => reminderInbox.filter((item) => !hiddenKeys.has(`reminder:${item.id}`)),
    [hiddenKeys, reminderInbox]
  )

  const totalCount = useMemo(
    () =>
      visibleFriendRequests.length +
      visibleInvitations.length +
      visibleCollectionRequests.length +
      visibleCollectionAlerts.length +
      visibleVotes.length +
      visibleMeetings.length +
      visibleReminders.length,
    [
      visibleCollectionAlerts.length,
      visibleCollectionRequests.length,
      visibleFriendRequests.length,
      visibleInvitations.length,
      visibleMeetings.length,
      visibleReminders.length,
      visibleVotes.length,
    ]
  )

  return {
    friendRequests: visibleFriendRequests,
    invitations: visibleInvitations,
    collectionRequests: visibleCollectionRequests,
    collectionAlerts: visibleCollectionAlerts,
    pendingVotes: visibleVotes,
    pendingMeetings: visibleMeetings,
    reminderInbox: visibleReminders,
    hideItem,
    hideItems,
    loading,
    totalCount,
    refresh,
  }
}

export function notifyHeaderNotificationsChanged() {
  window.dispatchEvent(new Event(HEADER_NOTIFICATIONS_CHANGED))
}
