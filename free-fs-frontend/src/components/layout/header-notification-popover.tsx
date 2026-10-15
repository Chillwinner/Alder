/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { Bell, Check, Clock, FolderInput, Loader2, UserPlus, Users, Video, Vote, X } from 'lucide-react'
import { decideFriendRequest, acceptWorkspaceInvitation, rejectWorkspaceInvitation, castNotificationVote, dismissAiReminders } from '@/lib/notification-commands'
import { toast } from 'sonner'
import { openMeetingWindow } from '@/api/meeting'
import type { WorkspaceVoteParticipant } from '@/api/vote'
import { UserAvatar } from '@/components/user-avatar'
import { useAuth } from '@/contexts/auth-context'
import { useHeaderAlarmRing, useHeaderCountAlert } from '@/hooks/use-header-count-alert'
import {
  notifyHeaderNotificationsChanged,
  useHeaderNotifications,
} from '@/hooks/use-header-notifications'
import { primeNotificationAudio } from '@/lib/notification-chime'
import { displayRoleName } from '@/utils/role-label'
import { translateServerText } from '@/i18n'
import { CollectionAskCard } from '@/components/layout/collection-ask-card'
import { HeaderAlertBadge } from '@/components/layout/header-alert-badge'
import UploadModal from '@/pages/files/components/UploadModal'
import { submitCollectionFiles } from '@/lib/submit-collection-files'
import { NotificationDismissButton } from '@/components/layout/notification-dismiss-button'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import './notif-pop.css'

function friendLabel(friend: { nickname?: string | null; username: string }) {
  return friend.nickname?.trim() || friend.username
}

export function HeaderNotificationPopover() {
  const { t } = useTranslation('layout')
  const { t: tInvite } = useTranslation('invite')
  const { t: tMessages } = useTranslation('messages')
  const { t: tSettings } = useTranslation('settings')
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user, loadWorkspaces, activateWorkspace } = useAuth()
  const [open, setOpen] = useState(false)
  const [actingKey, setActingKey] = useState<string | null>(null)
  const [collectId, setCollectId] = useState<string | null>(null)

  const {
    friendRequests,
    invitations,
    collectionRequests,
    collectionAlerts,
    pendingVotes,
    pendingMeetings,
    reminderInbox,
    hideItem,
    hideItems,
    loading,
    refresh,
  } = useHeaderNotifications(isAuthenticated)

  const alertKeys = useMemo(() => {
    const keys: string[] = []
    for (const friend of friendRequests) keys.push(`friend:${friend.friendId}`)
    for (const invitation of invitations) keys.push(`invite:${invitation.id}`)
    for (const request of collectionRequests) keys.push(`collection-ask:${request.id}`)
    for (const alert of collectionAlerts) {
      keys.push(`collection:${alert.collectionId}:${alert.submission.id}`)
    }
    for (const meeting of pendingMeetings) {
      keys.push(`meeting:${meeting.id}`)
    }
    for (const vote of pendingVotes) {
      const actionable =
        !vote.host || vote.pendingCount > 0 || (vote.participant && !vote.myChoice)
      if (!actionable) continue
      keys.push(`vote:${vote.id}`)
    }
    for (const reminder of reminderInbox) keys.push(`reminder:${reminder.id}`)
    return keys
  }, [collectionAlerts, collectionRequests, friendRequests, invitations, pendingMeetings, pendingVotes, reminderInbox])

  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open) return
    setSeenKeys((current) => {
      let changed = false
      const next = new Set(current)
      for (const key of alertKeys) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [alertKeys, open])

  const unseenCount = open ? 0 : alertKeys.filter((key) => !seenKeys.has(key)).length
  const hasAlarm = reminderInbox.length > 0
  const pulseAlert = useHeaderCountAlert(unseenCount, isAuthenticated && !open && !hasAlarm)
  const alarmRing = useHeaderAlarmRing(isAuthenticated && hasAlarm)
  const alerting = pulseAlert || alarmRing

  const dismissReminder = (inboxId: string) => {
    hideItem(`reminder:${inboxId}`)
    void dismissAiReminders([inboxId])
  }

  const clearAllVisible = () => {
    const keys: string[] = []
    for (const friend of friendRequests) keys.push(`friend:${friend.friendId}`)
    for (const invitation of invitations) keys.push(`invite:${invitation.id}`)
    for (const request of collectionRequests) keys.push(`collection-ask:${request.id}`)
    for (const alert of collectionAlerts) {
      keys.push(`collection:${alert.collectionId}:${alert.submission.id}`)
    }
    for (const meeting of pendingMeetings) {
      keys.push(`meeting:${meeting.id}`)
    }
    for (const vote of pendingVotes) {
      keys.push(`vote:${vote.id}`)
    }
    for (const reminder of reminderInbox) keys.push(`reminder:${reminder.id}`)
    hideItems(keys)
    void dismissAiReminders(reminderInbox.map((item) => item.id))
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSeenKeys((current) => {
        const nextKeys = new Set(current)
        for (const key of alertKeys) nextKeys.add(key)
        return nextKeys
      })
      void refresh()
    }
  }

  const handleAcceptFriend = async (friendId: string) => {
    setActingKey(`friend-accept-${friendId}`)
    try {
      await decideFriendRequest(friendId, true)
    } finally {
      setActingKey(null)
    }
  }

  const handleRejectFriend = async (friendId: string) => {
    setActingKey(`friend-reject-${friendId}`)
    try {
      await decideFriendRequest(friendId, false)
    } finally {
      setActingKey(null)
    }
  }

  const handleAcceptInvite = async (token: string, workspaceId: string) => {
    setActingKey(`invite-accept-${token}`)
    try {
      await acceptWorkspaceInvitation(token, workspaceId, {
        loadWorkspaces,
        activateWorkspace,
        openWorkspace: (nextSlug) => {
          navigate(`/w/${nextSlug}/`)
          setOpen(false)
        },
        onAcceptFailed: () => void refresh(),
      })
    } finally {
      setActingKey(null)
    }
  }

  const handleRejectInvite = async (token: string) => {
    setActingKey(`invite-reject-${token}`)
    try {
      await rejectWorkspaceInvitation(token, () => void refresh())
    } finally {
      setActingKey(null)
    }
  }

  const collectionsHref = slug
    ? `/w/${slug}/files?view=collections`
    : '/files?view=collections'

  const handleCastVote = async (
    voteId: string,
    choice: 'AGREE' | 'DISAGREE',
    workspaceId?: string | null
  ) => {
    setActingKey(`vote-${choice}-${voteId}`)
    try {
      await castNotificationVote(voteId, choice, workspaceId)
    } finally {
      setActingKey(null)
    }
  }

  const isEmpty =
    !loading &&
    friendRequests.length === 0 &&
    invitations.length === 0 &&
    collectionRequests.length === 0 &&
    collectionAlerts.length === 0 &&
    pendingVotes.length === 0 &&
    pendingMeetings.length === 0 &&
    reminderInbox.length === 0

  return (
    <>
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className={cn(
            'relative size-8 text-muted-foreground hover:bg-accent hover:text-foreground',
            open && 'bg-accent text-foreground',
            alarmRing && 'header-alert-shake-loop text-destructive',
            !alarmRing && alerting && 'header-alert-shake text-destructive'
          )}
          aria-label={t('header.notifications.title')}
          onPointerDown={() => primeNotificationAudio()}
        >
          <Bell className='size-[18px]' strokeWidth={1.75} />
          <HeaderAlertBadge count={unseenCount} alerting={alerting} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='notif-pop w-[min(23rem,calc(100vw-2rem))] p-0'
      >
        {/* 顶栏标题：让弹层与主界面同一套层级（之前是直接堆列表） */}
        <header className='notif-pop__head'>
          <div className='min-w-0'>
            <p className='notif-pop__title'>{t('header.notifications.title')}</p>
            <p className='notif-pop__sub'>{t('header.notifications.subtitle')}</p>
          </div>
          <div className='flex shrink-0 items-center gap-1.5'>
            {!isEmpty ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground'
                onClick={clearAllVisible}
              >
                {t('header.notifications.clearAll')}
              </Button>
            ) : null}
            {unseenCount > 0 ? (
              <span className='a-tag a-tag--accent font-mono tabular-nums'>
                {unseenCount > 99 ? '99+' : unseenCount}
              </span>
            ) : null}
          </div>
        </header>
        <div className='notif-pop__body'>
          {loading && isEmpty ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='size-5 animate-spin text-muted-foreground' />
            </div>
          ) : isEmpty ? (
            <p className='py-8 text-center text-sm text-muted-foreground'>
              {t('header.notifications.empty')}
            </p>
          ) : (
            <div className='flex flex-col gap-3'>
              {reminderInbox.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <Clock className='size-3.5' />
                    {t('header.notifications.reminders')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {reminderInbox.map((item) => (
                      <li key={item.id} className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'>
                        <NotificationDismissButton
                          label={t('header.notifications.dismiss')}
                          onClick={() => dismissReminder(item.id)}
                        />
                        <p className='text-sm font-medium whitespace-pre-wrap'>{item.message}</p>
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          {item.workspaceName ? `${item.workspaceName} · ` : ''}
                          {item.firedAt ? dayjs(item.firedAt).format('MM-DD HH:mm') : ''}
                        </p>
                        <Button
                          type='button'
                          className='mt-2 h-9 w-full text-sm'
                          variant='destructive'
                          onClick={() => dismissReminder(item.id)}
                        >
                          {t('header.notifications.dismissAlarm')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {pendingMeetings.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <Video className='size-3.5' />
                    {t('header.notifications.meetings')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {pendingMeetings.map((meeting) => (
                      <li key={meeting.id} className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'>
                        <NotificationDismissButton
                          label={t('header.notifications.dismiss')}
                          onClick={() =>
                            hideItem(
                              `meeting:${meeting.id}`
                            )
                          }
                        />
                        <p className='text-sm font-medium'>{meeting.title}</p>
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          {meeting.workspaceName ? `${meeting.workspaceName} · ` : ''}
                          {dayjs(meeting.startsAt).format('MM-DD HH:mm')}
                        </p>
                        {meeting.canEnter ? (
                          <Button
                            type='button'
                            size='sm'
                            className='mt-2 h-7 w-full text-xs'
                            onClick={() => {
                              setOpen(false)
                              openMeetingWindow(meeting.id, meeting.workspaceId)
                            }}
                          >
                            {t('header.notifications.enterMeeting')}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {pendingVotes.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <Vote className='size-3.5' />
                    {t('header.notifications.votes')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {pendingVotes.map((vote) => {
                      const agreeBusy = actingKey === `vote-AGREE-${vote.id}`
                      const disagreeBusy = actingKey === `vote-DISAGREE-${vote.id}`
                      const busy = agreeBusy || disagreeBusy
                      const canVote = Boolean(vote.participant) && !vote.myChoice
                      const total = vote.agreeCount + vote.disagreeCount + vote.pendingCount
                      const agreePct = total ? (vote.agreeCount / total) * 100 : 0
                      const disagreePct = total ? (vote.disagreeCount / total) * 100 : 0
                      return (
                        <li
                          key={vote.id}
                          className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'
                        >
                          <NotificationDismissButton
                            label={t('header.notifications.dismiss')}
                            onClick={() =>
                              hideItem(`vote:${vote.id}`)
                            }
                          />
                          <p className='text-sm font-medium'>{vote.title}</p>
                          {vote.workspaceName ? (
                            <p className='mt-0.5 text-xs text-muted-foreground'>
                              {vote.workspaceName}
                            </p>
                          ) : null}
                          {vote.host ? (
                            <>
                              <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-muted'>
                                <div className='flex h-full'>
                                  <div className='bg-success' style={{ width: `${agreePct}%` }} />
                                  <div className='bg-destructive' style={{ width: `${disagreePct}%` }} />
                                </div>
                              </div>
                              <p className='mt-1.5 text-xs text-muted-foreground'>
                                {t('header.notifications.voteTally', {
                                  agree: vote.agreeCount,
                                  disagree: vote.disagreeCount,
                                  pending: vote.pendingCount,
                                })}
                              </p>
                              {(vote.participants ?? []).length > 0 ? (
                                <div className='mt-2 flex flex-wrap gap-2'>
                                  {(vote.participants ?? []).map((person: WorkspaceVoteParticipant) => {
                                    const name = person.nickname?.trim() || person.username?.trim() || ''
                                    return (
                                      <div key={person.userId} className='flex w-12 flex-col items-center gap-1'>
                                        <div className='relative'>
                                          <UserAvatar name={name} avatar={person.avatar ?? undefined} size={28} className='rounded-full' />
                                          {person.choice === 'AGREE' ? (
                                            <span className='absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-success text-white'>
                                              <Check className='size-2' strokeWidth={3} />
                                            </span>
                                          ) : null}
                                          {person.choice === 'DISAGREE' ? (
                                            <span className='absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-white'>
                                              <X className='size-2' strokeWidth={3} />
                                            </span>
                                          ) : null}
                                        </div>
                                        <span className='w-full truncate text-center text-[10px] text-muted-foreground'>{name}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {canVote ? (
                            <div className='mt-2 flex gap-1.5'>
                              <Button
                                type='button'
                                size='sm'
                                className='h-7 flex-1 text-xs'
                                disabled={busy}
                                onClick={() =>
                                  void handleCastVote(vote.id, 'AGREE', vote.workspaceId)
                                }
                              >
                                {agreeBusy ? (
                                  <Loader2 className='size-3.5 animate-spin' />
                                ) : (
                                  t('header.notifications.agree')
                                )}
                              </Button>
                              <Button
                                type='button'
                                size='sm'
                                variant='outline'
                                className='h-7 flex-1 text-xs'
                                disabled={busy}
                                onClick={() =>
                                  void handleCastVote(vote.id, 'DISAGREE', vote.workspaceId)
                                }
                              >
                                {disagreeBusy ? (
                                  <Loader2 className='size-3.5 animate-spin' />
                                ) : (
                                  t('header.notifications.disagree')
                                )}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {friendRequests.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <UserPlus className='size-3.5' />
                    {t('header.notifications.friends')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {friendRequests.map((friend) => {
                      const busy =
                        actingKey === `friend-accept-${friend.friendId}` ||
                        actingKey === `friend-reject-${friend.friendId}`
                      return (
                        <li
                          key={friend.friendId}
                          className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'
                        >
                          <NotificationDismissButton
                            label={t('header.notifications.dismiss')}
                            onClick={() => hideItem(`friend:${friend.friendId}`)}
                          />
                          <p className='text-sm font-medium'>
                            {friendLabel(friend)}
                          </p>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {t('header.notifications.friendRequestHint')}
                          </p>
                          <div className='mt-2 flex gap-1.5'>
                            <Button
                              type='button'
                              size='sm'
                              className='h-7 flex-1 text-xs'
                              disabled={busy}
                              onClick={() =>
                                void handleAcceptFriend(friend.friendId)
                              }
                            >
                              {busy &&
                              actingKey === `friend-accept-${friend.friendId}` ? (
                                <Loader2 className='size-3.5 animate-spin' />
                              ) : (
                                tMessages('friends.accept')
                              )}
                            </Button>
                            <Button
                              type='button'
                              size='sm'
                              variant='outline'
                              className='h-7 flex-1 text-xs'
                              disabled={busy}
                              onClick={() =>
                                void handleRejectFriend(friend.friendId)
                              }
                            >
                              {tMessages('friends.reject')}
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {invitations.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <Users className='size-3.5' />
                    {t('header.notifications.workspaceInvites')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {invitations.map((inv) => {
                      const token = inv.token ?? ''
                      const busy =
                        actingKey === `invite-accept-${token}` ||
                        actingKey === `invite-reject-${token}`
                      return (
                        <li
                          key={inv.id}
                          className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'
                        >
                          <NotificationDismissButton
                            label={t('header.notifications.dismiss')}
                            onClick={() => hideItem(`invite:${inv.id}`)}
                          />
                          <p className='text-sm font-medium'>{inv.workspaceName}</p>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {tInvite('invitedBy')} {inv.inviterName} ·{' '}
                            {displayRoleName(tSettings, {
                              roleName: inv.roleName,
                              roleCode: inv.roleCode,
                            })}
                          </p>
                          <p className='mt-0.5 text-[11px] text-muted-foreground'>
                            {dayjs(inv.expiresAt).format('YYYY-MM-DD HH:mm')}
                          </p>
                          <div className='mt-2 flex gap-1.5'>
                            <Button
                              type='button'
                              size='sm'
                              className='h-7 flex-1 text-xs'
                              disabled={busy || !token}
                              onClick={() =>
                                void handleAcceptInvite(token, inv.workspaceId)
                              }
                            >
                              {busy && actingKey === `invite-accept-${token}` ? (
                                <Loader2 className='size-3.5 animate-spin' />
                              ) : (
                                tInvite('acceptInvite')
                              )}
                            </Button>
                            <Button
                              type='button'
                              size='sm'
                              variant='outline'
                              className='h-7 flex-1 text-xs'
                              disabled={busy || !token}
                              onClick={() => void handleRejectInvite(token)}
                            >
                              {tInvite('rejectInvite')}
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {collectionRequests.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <FolderInput className='size-3.5' />
                    {t('header.notifications.collections')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {collectionRequests.map((item) => (
                      <CollectionAskCard
                        key={item.id}
                        item={item}
                        onDismiss={() => hideItem(`collection-ask:${item.id}`)}
                        onSubmit={() => {
                          setOpen(false)
                          setCollectId(item.id)
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {collectionAlerts.length > 0 ? (
                <section>
                  <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'>
                    <FolderInput className='size-3.5' />
                    {t('header.notifications.collections')}
                  </div>
                  <ul className='flex flex-col gap-2'>
                    {collectionAlerts.map((alert) => (
                      <li
                        key={`${alert.collectionId}-${alert.submission.id}`}
                        className='relative'
                      >
                        <NotificationDismissButton
                          label={t('header.notifications.dismiss')}
                          onClick={() =>
                            hideItem(`collection:${alert.collectionId}:${alert.submission.id}`)
                          }
                        />
                        <button
                          type='button'
                          className='w-full rounded-lg border bg-card px-2.5 py-2 pr-8 text-left transition-colors hover:bg-muted/40'
                          onClick={() => {
                            setOpen(false)
                            navigate(collectionsHref)
                          }}
                        >
                          <p className='text-sm font-medium'>
                            {alert.collectionName}
                          </p>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {t('header.notifications.collectionSubmission', {
                              name: alert.submission.submitterName,
                              count: alert.submission.fileCount,
                            })}
                          </p>
                          <p className='mt-0.5 text-[11px] text-muted-foreground'>
                            {dayjs(alert.submission.createdAt).format(
                              'YYYY-MM-DD HH:mm'
                            )}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
        {!isEmpty ? (
          <footer className='notif-pop__foot'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-8 w-full rounded-full text-xs'
              onClick={() => {
                setOpen(false)
                navigate(slug ? `/w/${slug}/notifications` : '/invitations')
              }}
            >
              {t('header.notifications.viewAll')}
            </Button>
          </footer>
        ) : null}
      </PopoverContent>
    </Popover>
    <UploadModal
      open={Boolean(collectId)}
      onOpenChange={(next) => {
        if (!next) setCollectId(null)
      }}
      title={t('header.notifications.collectionSubmit')}
      submitLabel={t('header.notifications.collectionSubmit')}
      onPick={(files) => {
        const id = collectId
        const name = user?.nickname?.trim() || user?.username || 'user'
        if (!id) return
        void submitCollectionFiles(id, files, name)
          .then(() => {
            toast.success(t('header.notifications.collectionSubmitted'))
            notifyHeaderNotificationsChanged()
          })
          .catch((error) =>
            toast.error(error instanceof Error ? translateServerText(error.message) : t('header.notifications.collections'))
          )
      }}
    />
    </>
  )
}
