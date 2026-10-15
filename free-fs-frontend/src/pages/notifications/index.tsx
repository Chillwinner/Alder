/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Check,
  Clock,
  FolderInput,
  Loader2,
  UserPlus,
  Users,
  Video,
  Vote,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { openMeetingWindow } from '@/api/meeting'
import { decideFriendRequest, acceptWorkspaceInvitation, rejectWorkspaceInvitation, castNotificationVote, dismissAiReminders } from '@/lib/notification-commands'
import type { WorkspaceVoteParticipant } from '@/api/vote'
import {
  HubEmpty,
  HubLoading,
  HubPageShell,
} from '@/components/collab/hub-shell'
import { UserAvatar } from '@/components/user-avatar'
import { useAuth } from '@/contexts/auth-context'
import {
  notifyHeaderNotificationsChanged,
  useHeaderNotifications,
} from '@/hooks/use-header-notifications'
import { displayRoleName } from '@/utils/role-label'
import { translateServerText } from '@/i18n'
import { CollectionAskCard } from '@/components/layout/collection-ask-card'
import { NotificationDismissButton } from '@/components/layout/notification-dismiss-button'
import UploadModal from '@/pages/files/components/UploadModal'
import { submitCollectionFiles } from '@/lib/submit-collection-files'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function friendLabel(friend: { nickname?: string | null; username: string }) {
  return friend.nickname?.trim() || friend.username
}

function VoteFaces({ people }: { people: WorkspaceVoteParticipant[] }) {
  if (people.length === 0) return null
  return (
    <div className='mt-3 flex flex-wrap gap-3'>
      {people.map((person) => {
        const name = person.nickname?.trim() || person.username?.trim() || ''
        return (
          <div key={person.userId} className='flex w-[3.25rem] flex-col items-center gap-1.5'>
            <div className='relative'>
              <UserAvatar name={name} avatar={person.avatar ?? undefined} size={36} className='rounded-full' />
              {person.choice === 'AGREE' ? (
                <span className='absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-success text-background ring-2 ring-surface-secondary'>
                  <Check className='size-2.5' strokeWidth={3} />
                </span>
              ) : null}
              {person.choice === 'DISAGREE' ? (
                <span className='absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-background ring-2 ring-surface-secondary'>
                  <X className='size-2.5' strokeWidth={3} />
                </span>
              ) : null}
            </div>
            <span className='w-full truncate text-center text-[11px] leading-tight text-muted-foreground'>
              {name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className='mt-3 flex flex-wrap gap-2'>{children}</div>
}

/** 行尾：未读点 + 消失按钮（对齐 demo 右侧的蓝点） */
function RowTrailing({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className='flex items-center gap-1.5'>
      <span className='size-2 shrink-0 rounded-full bg-primary' aria-hidden />
      <NotificationDismissButton label={label} className='relative top-0 right-0' onClick={onClick} />
    </div>
  )
}

/*
 * 通知分组卡：demo 的三层结构 ——
 *   头部行（图标 + 标题/描述 + 右侧计数胶囊）/ 内层列表 / 底部说明行
 * 未读项用左侧色条标记。
 */
function NoticeCard({
  title,
  desc,
  icon: Icon,
  tone,
  count,
  foot,
  children,
}: {
  title: string
  desc: string
  icon: LucideIcon
  tone: string
  count: number
  foot: string
  children: ReactNode
}) {
  return (
    <section className='a-glass rounded-[22px] p-4 sm:p-[18px]'>
      <div className='a-bcell__head'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-[9px]', tone)}>
            <Icon className='size-4' strokeWidth={1.9} aria-hidden />
          </span>
          <div className='min-w-0'>
            <h3 className='truncate'>{title}</h3>
            <p className='mt-0.5 truncate text-[12.5px] text-text-secondary'>{desc}</p>
          </div>
        </div>
        <span className='a-tag shrink-0 font-mono tabular-nums'>{count}</span>
      </div>

      <ul className='flex flex-col gap-2'>{children}</ul>

      <div className='mt-3.5 border-t border-divider pt-3 text-[12px] text-text-muted'>
        <span className='truncate'>{foot}</span>
      </div>
    </section>
  )
}

/** 单条通知行：左侧未读色条 + 图标底座 + 正文 + 行尾 */
function NoticeItem({ children, trailing }: { children: ReactNode; trailing: ReactNode }) {
  return (
    <li
      className={cn(
        'relative flex gap-3.5 overflow-hidden rounded-[16px] border border-divider',
        'bg-surface-secondary/60 p-3.5 transition-[background-color,box-shadow,translate] duration-200',
        'hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-[var(--shadow-lg)]'
      )}
    >
      <span
        className='absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary'
        aria-hidden
      />
      {children}
      <div className='ml-auto flex shrink-0 items-start justify-end gap-2 self-start'>{trailing}</div>
    </li>
  )
}

const NOTICE_TILE = 'flex size-10 shrink-0 items-center justify-center rounded-[13px]'

export default function NotificationsPage() {
  const { t } = useTranslation('layout')
  const { t: tInvite } = useTranslation('invite')
  const { t: tMessages } = useTranslation('messages')
  const { t: tSettings } = useTranslation('settings')
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user, loadWorkspaces, activateWorkspace } = useAuth()
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
    loading,
    refresh,
  } = useHeaderNotifications(isAuthenticated)

  const collectionsHref = slug
    ? `/w/${slug}/files?view=collections`
    : '/files?view=collections'

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
    <HubPageShell
      eyebrow={t('header.notifications.eyebrow')}
      title={t('header.notifications.title')}
      description={t('header.notifications.subtitle')}
    >
      {loading && isEmpty ? <HubLoading /> : null}
      {!loading && isEmpty ? <HubEmpty icon={Bell} message={t('header.notifications.empty')} /> : null}
      {!loading && !isEmpty ? (
        <div className='flex flex-col gap-7'>
          {reminderInbox.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.reminders')}
              desc={t('header.notifications.remindersDesc')}
              icon={Clock}
              tone='bg-warning/12 text-warning'
              count={reminderInbox.length}
              foot={t('header.notifications.groupFoot', { count: reminderInbox.length })}
            >
              {reminderInbox.map((item) => (
                <NoticeItem
                  key={item.id}
                  trailing={
                    <RowTrailing
                      label={t('header.notifications.dismiss')}
                      onClick={() => {
                        hideItem(`reminder:${item.id}`)
                        void dismissAiReminders([item.id])
                      }}
                    />
                  }
                >
                  <span className={cn(NOTICE_TILE, 'bg-warning/12 text-warning')}>
                    <Clock className='size-[18px]' strokeWidth={1.8} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary whitespace-pre-wrap'>
                      {item.message}
                    </p>
                    <p className='mt-1 text-[12px] text-text-secondary'>
                      {item.workspaceName ? `${item.workspaceName} · ` : ''}
                      {item.firedAt ? (
                        <span className='font-mono tabular-nums'>
                          {dayjs(item.firedAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      ) : (
                        ''
                      )}
                    </p>
                    <ActionRow>
                      <Button
                        type='button'
                        variant='destructive'
                        className='a-btn a-btn--sm a-btn--plain text-destructive'
                        onClick={() => {
                          hideItem(`reminder:${item.id}`)
                          void dismissAiReminders([item.id])
                        }}
                      >
                        {t('header.notifications.dismissAlarm')}
                      </Button>
                    </ActionRow>
                  </div>
                </NoticeItem>
              ))}
            </NoticeCard>
          ) : null}

          {pendingMeetings.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.meetings')}
              desc={t('header.notifications.meetingsDesc')}
              icon={Video}
              tone='bg-primary/10 text-primary'
              count={pendingMeetings.length}
              foot={t('header.notifications.groupFoot', { count: pendingMeetings.length })}
            >
              {pendingMeetings.map((meeting) => (
                <NoticeItem
                  key={meeting.id}
                  trailing={
                    <RowTrailing
                      label={t('header.notifications.dismiss')}
                      onClick={() =>
                        hideItem(
                          `meeting:${meeting.id}:${meeting.status ?? ''}:${meeting.canEnter ? 1 : 0}`
                        )
                      }
                    />
                  }
                >
                  <span className={cn(NOTICE_TILE, 'bg-primary/10 text-primary')}>
                    <Video className='size-[18px]' strokeWidth={1.8} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
                      {meeting.title}
                    </p>
                    <p className='mt-1 text-[12px] text-text-secondary'>
                      {meeting.workspaceName ? `${meeting.workspaceName} · ` : ''}
                      <span className='font-mono tabular-nums'>
                        {dayjs(meeting.startsAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </p>
                    {meeting.canEnter ? (
                      <ActionRow>
                        <Button
                          type='button'
                          className='a-btn a-btn--primary a-btn--sm'
                          onClick={() => openMeetingWindow(meeting.id, meeting.workspaceId)}
                        >
                          {t('header.notifications.enterMeeting')}
                        </Button>
                      </ActionRow>
                    ) : null}
                  </div>
                </NoticeItem>
              ))}
            </NoticeCard>
          ) : null}

          {pendingVotes.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.votes')}
              desc={t('header.notifications.votesDesc')}
              icon={Vote}
              tone='bg-success/12 text-success'
              count={pendingVotes.length}
              foot={t('header.notifications.groupFoot', { count: pendingVotes.length })}
            >
              {pendingVotes.map((vote) => {
                  const agreeBusy = actingKey === `vote-AGREE-${vote.id}`
                  const disagreeBusy = actingKey === `vote-DISAGREE-${vote.id}`
                  const busy = agreeBusy || disagreeBusy
                  const canVote = Boolean(vote.participant) && !vote.myChoice
                  const total = vote.agreeCount + vote.disagreeCount + vote.pendingCount
                  const agreePct = total ? (vote.agreeCount / total) * 100 : 0
                  const disagreePct = total ? (vote.disagreeCount / total) * 100 : 0
                  return (
                    <NoticeItem
                      key={vote.id}
                      trailing={
                        <RowTrailing
                          label={t('header.notifications.dismiss')}
                          onClick={() =>
                            hideItem(`vote:${vote.id}:${vote.pendingCount}:${vote.myChoice ?? ''}`)
                          }
                        />
                      }
                    >
                      <span className={cn(NOTICE_TILE, 'bg-success/12 text-success')}>
                        <Vote className='size-[18px]' strokeWidth={1.8} />
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
                          {vote.title}
                        </p>
                        {vote.workspaceName ? (
                          <p className='mt-1 text-[12px] text-text-secondary'>{vote.workspaceName}</p>
                        ) : null}
                        {/* 批注区块：demo 的内嵌浅底面板（计票 + 参与者） */}
                        {vote.host ? (
                          <div className='mt-3 rounded-[13px] bg-surface-secondary p-3'>
                            <div className='a-bar'>
                              <span className='flex h-full'>
                                <span
                                  className='block h-full bg-success transition-all'
                                  style={{ width: `${agreePct}%` }}
                                />
                                <span
                                  className='block h-full bg-destructive transition-all'
                                  style={{ width: `${disagreePct}%` }}
                                />
                              </span>
                            </div>
                            <p className='mt-2 font-mono text-[12px] tabular-nums text-text-muted'>
                              {t('header.notifications.voteTally', {
                                agree: vote.agreeCount,
                                disagree: vote.disagreeCount,
                                pending: vote.pendingCount,
                              })}
                            </p>
                            <VoteFaces people={vote.participants ?? []} />
                          </div>
                        ) : null}
                        {canVote ? (
                          <ActionRow>
                            <Button
                              type='button'
                              className='a-btn a-btn--primary a-btn--sm'
                              disabled={busy}
                              onClick={() => {
                                setActingKey(`vote-AGREE-${vote.id}`)
                                void castNotificationVote(vote.id, 'AGREE', vote.workspaceId).finally(() =>
                                  setActingKey(null)
                                )
                              }}
                            >
                              {agreeBusy ? (
                                <Loader2 className='size-3.5 animate-spin' />
                              ) : (
                                t('header.notifications.agree')
                              )}
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              className='a-btn a-btn--secondary a-btn--sm'
                              disabled={busy}
                              onClick={() => {
                                setActingKey(`vote-DISAGREE-${vote.id}`)
                                void castNotificationVote(vote.id, 'DISAGREE', vote.workspaceId).finally(() =>
                                  setActingKey(null)
                                )
                              }}
                            >
                              {disagreeBusy ? (
                                <Loader2 className='size-3.5 animate-spin' />
                              ) : (
                                t('header.notifications.disagree')
                              )}
                            </Button>
                          </ActionRow>
                        ) : null}
                      </div>
                    </NoticeItem>
                  )
                })}
            </NoticeCard>
          ) : null}

          {friendRequests.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.friends')}
              desc={t('header.notifications.friendsDesc')}
              icon={UserPlus}
              tone='bg-primary/10 text-primary'
              count={friendRequests.length}
              foot={t('header.notifications.groupFoot', { count: friendRequests.length })}
            >
              {friendRequests.map((friend) => {
                  const busy =
                    actingKey === `friend-accept-${friend.friendId}` ||
                    actingKey === `friend-reject-${friend.friendId}`
                  return (
                    <NoticeItem
                      key={friend.friendId}
                      trailing={
                        <RowTrailing
                          label={t('header.notifications.dismiss')}
                          onClick={() => hideItem(`friend:${friend.friendId}`)}
                        />
                      }
                    >
                      <span className={cn(NOTICE_TILE, 'bg-primary/10 text-primary')}>
                        <UserPlus className='size-[18px]' strokeWidth={1.8} />
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
                          {friendLabel(friend)}
                        </p>
                        <p className='mt-1 text-[12px] text-text-secondary'>
                          {t('header.notifications.friendRequestHint')}
                        </p>
                        <ActionRow>
                          <Button
                            type='button'
                            className='a-btn a-btn--primary a-btn--sm'
                            disabled={busy}
                            onClick={() => {
                              setActingKey(`friend-accept-${friend.friendId}`)
                              void decideFriendRequest(friend.friendId, true).finally(() => setActingKey(null))
                            }}
                          >
                            {tMessages('friends.accept')}
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            className='a-btn a-btn--secondary a-btn--sm'
                            disabled={busy}
                            onClick={() => {
                              setActingKey(`friend-reject-${friend.friendId}`)
                              void decideFriendRequest(friend.friendId, false).finally(() => setActingKey(null))
                            }}
                          >
                            {tMessages('friends.reject')}
                          </Button>
                        </ActionRow>
                      </div>
                    </NoticeItem>
                  )
                })}
            </NoticeCard>
          ) : null}

          {invitations.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.workspaceInvites')}
              desc={t('header.notifications.invitesDesc')}
              icon={Users}
              tone='bg-primary/10 text-primary'
              count={invitations.length}
              foot={t('header.notifications.groupFoot', { count: invitations.length })}
            >
              {invitations.map((inv) => {
                  const token = inv.token ?? ''
                  const busy =
                    actingKey === `invite-accept-${token}` || actingKey === `invite-reject-${token}`
                  return (
                    <NoticeItem
                      key={inv.id}
                      trailing={
                        <RowTrailing
                          label={t('header.notifications.dismiss')}
                          onClick={() => hideItem(`invite:${inv.id}`)}
                        />
                      }
                    >
                      <span className={cn(NOTICE_TILE, 'bg-primary/10 text-primary')}>
                        <Users className='size-[18px]' strokeWidth={1.8} />
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
                          {inv.workspaceName}
                        </p>
                        <p className='mt-1 text-[12px] text-text-secondary'>
                          {tInvite('invitedBy')} {inv.inviterName}
                        </p>
                        <p className='mt-0.5 text-[12px] text-text-muted'>
                          {displayRoleName(tSettings, {
                            roleName: inv.roleName,
                            roleCode: inv.roleCode,
                          })}
                          {' · '}
                          <span className='font-mono tabular-nums'>
                            {dayjs(inv.expiresAt).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </p>
                        <ActionRow>
                          <Button
                            type='button'
                            className='a-btn a-btn--primary a-btn--sm'
                            disabled={busy || !token}
                            onClick={() => {
                              setActingKey(`invite-accept-${token}`)
                              void acceptWorkspaceInvitation(token, inv.workspaceId, {
                                loadWorkspaces,
                                activateWorkspace,
                                openWorkspace: (nextSlug) => navigate(`/w/${nextSlug}/`),
                                onAcceptFailed: () => void refresh(),
                              }).finally(() => setActingKey(null))
                            }}
                          >
                            {tInvite('acceptInvite')}
                          </Button>
                          <Button
                            type='button'
                            variant='outline'
                            className='a-btn a-btn--secondary a-btn--sm'
                            disabled={busy || !token}
                            onClick={() => {
                              setActingKey(`invite-reject-${token}`)
                              void rejectWorkspaceInvitation(token, () => void refresh()).finally(() =>
                                setActingKey(null)
                              )
                            }}
                          >
                            {tInvite('rejectInvite')}
                          </Button>
                        </ActionRow>
                      </div>
                    </NoticeItem>
                  )
                })}
            </NoticeCard>
          ) : null}

          {collectionRequests.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.collections')}
              desc={t('header.notifications.collectionAssignedDesc')}
              icon={FolderInput}
              tone='bg-warning/12 text-warning'
              count={collectionRequests.length}
              foot={t('header.notifications.groupFoot', { count: collectionRequests.length })}
            >
              <ul className='flex flex-col gap-2 px-3 pb-3'>
                {collectionRequests.map((item) => (
                  <CollectionAskCard
                    key={item.id}
                    item={item}
                    onDismiss={() => hideItem(`collection-ask:${item.id}`)}
                    onSubmit={() => setCollectId(item.id)}
                  />
                ))}
              </ul>
            </NoticeCard>
          ) : null}

          {collectionAlerts.length > 0 ? (
            <NoticeCard
              title={t('header.notifications.collections')}
              desc={t('header.notifications.collectionsDesc')}
              icon={FolderInput}
              tone='bg-warning/12 text-warning'
              count={collectionAlerts.length}
              foot={t('header.notifications.groupFoot', { count: collectionAlerts.length })}
            >
              {collectionAlerts.map((alert) => (
                <NoticeItem
                  key={`${alert.collectionId}-${alert.submission.id}`}
                  trailing={
                    <RowTrailing
                      label={t('header.notifications.dismiss')}
                      onClick={() =>
                        hideItem(`collection:${alert.collectionId}:${alert.submission.id}`)
                      }
                    />
                  }
                >
                  <span className={cn(NOTICE_TILE, 'bg-warning/12 text-warning')}>
                    <FolderInput className='size-[18px]' strokeWidth={1.8} />
                  </span>
                  <button
                    type='button'
                    className={cn(
                      'block min-w-0 flex-1 rounded-[10px] text-left',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                    onClick={() => navigate(collectionsHref)}
                  >
                    <p className='text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
                      {alert.collectionName}
                    </p>
                    <p className='mt-1 text-[12px] text-text-secondary'>
                      {t('header.notifications.collectionSubmission', {
                        name: alert.submission.submitterName,
                        count: alert.submission.fileCount,
                      })}
                    </p>
                    <p className='mt-1 font-mono text-[12px] tabular-nums text-text-muted'>
                      {dayjs(alert.submission.createdAt).format('YYYY-MM-DD HH:mm')}
                    </p>
                  </button>
                </NoticeItem>
              ))}
            </NoticeCard>
          ) : null}
        </div>
      ) : null}
    </HubPageShell>
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
            toast.error(
              error instanceof Error
                ? translateServerText(error.message)
                : t('header.notifications.collections')
            )
          )
      }}
    />
    </>
  )
}
