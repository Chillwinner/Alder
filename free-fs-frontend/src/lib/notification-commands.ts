/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { toast } from 'sonner'
import { acceptFriend, rejectFriend } from '@/api/im'
import { invitationApi } from '@/api/invitation'
import { castWorkspaceVote } from '@/api/vote'
import { aiApi } from '@/api/ai'
import i18n, { translateServerText } from '@/i18n'
import { notifyHeaderNotificationsChanged } from '@/hooks/use-header-notifications'
import { notifyInvitationsChanged } from '@/hooks/use-workspace-invitations'
import { useWorkspaceStore } from '@/store/workspace'

function friendError(cause: unknown) {
  return cause instanceof Error
    ? translateServerText(cause.message, i18n.t('messages:friends.actionFailed'))
    : i18n.t('messages:friends.actionFailed')
}

/** 好友申请。铃铛和通知页共用。 */
export async function decideFriendRequest(friendId: string, accept: boolean) {
  try {
    if (accept) {
      await acceptFriend(friendId)
      toast.success(i18n.t('messages:friends.accepted'))
    } else {
      await rejectFriend(friendId)
    }
    notifyHeaderNotificationsChanged()
  } catch (cause) {
    toast.error(friendError(cause))
  }
}

type InviteSession = {
  loadWorkspaces: () => Promise<unknown>
  activateWorkspace: (workspaceId: string) => Promise<unknown>
  openWorkspace: (slug: string) => void
  onAcceptFailed?: () => void
}

/** 接受工作空间邀请并切到那个空间。 */
export async function acceptWorkspaceInvitation(
  token: string,
  workspaceId: string,
  session: InviteSession
) {
  try {
    await invitationApi.acceptInvitation(token)
    toast.success(i18n.t('invite:acceptSuccess'))
    notifyInvitationsChanged()
    notifyHeaderNotificationsChanged()
    await session.loadWorkspaces()
    const { workspaces } = useWorkspaceStore.getState()
    const target = workspaces.find((item) => item.id === workspaceId) ?? workspaces[0]
    if (target) {
      await session.activateWorkspace(target.id)
      session.openWorkspace(target.slug)
    }
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : i18n.t('invite:acceptFailed'))
    session.onAcceptFailed?.()
  }
}

export async function rejectWorkspaceInvitation(token: string, onFailed?: () => void) {
  try {
    await invitationApi.rejectInvitation(token)
    toast.success(i18n.t('invite:rejectSuccess'))
    notifyInvitationsChanged()
    notifyHeaderNotificationsChanged()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : i18n.t('invite:rejectFailed'))
    onFailed?.()
  }
}

export async function castNotificationVote(
  voteId: string,
  choice: 'AGREE' | 'DISAGREE',
  workspaceId?: string | null
) {
  try {
    await castWorkspaceVote(voteId, choice, workspaceId)
    notifyHeaderNotificationsChanged()
  } catch (cause) {
    toast.error(
      cause instanceof Error
        ? translateServerText(cause.message, i18n.t('layout:header.notifications.votes'))
        : i18n.t('layout:header.notifications.votes')
    )
  }
}

export async function dismissAiReminders(inboxIds: string[]) {
  if (inboxIds.length === 0) return
  await Promise.all(inboxIds.map((id) => aiApi.dismissReminderInbox(id)))
  notifyHeaderNotificationsChanged()
}
