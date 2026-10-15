/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { CalendarClock, Plus, Radio, Video } from 'lucide-react'
import { toast } from 'sonner'
import { workspaceApi } from '@/api/workspace'
import {
  closeWorkspaceMeeting,
  createWorkspaceMeeting,
  listWorkspaceMeetings,
  openMeetingWindow,
  type WorkspaceMeeting,
} from '@/api/meeting'
import {
  HubEmpty,
  HubLoading,
  HubPageShell,
} from '@/components/collab/hub-shell'
import { notifyHeaderNotificationsChanged } from '@/hooks/use-header-notifications'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translateServerText } from '@/i18n'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace'
import type { WorkspaceMember } from '@/types/workspace'

function memberLabel(member: { nickname?: string | null; username?: string | null }) {
  return member.nickname?.trim() || member.username?.trim() || ''
}

function meetingSortKey(meeting: WorkspaceMeeting) {
  return new Date(meeting.startsAt).getTime()
}

export default function MeetingsPage() {
  const { t } = useTranslation('board')
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const meetingsQuery = useQuery({
    queryKey: ['workspace-meetings', slug],
    queryFn: () => listWorkspaceMeetings(),
  })
  const membersQuery = useQuery({
    queryKey: ['workspace-members', slug, 'meetings'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 200 }),
    enabled: open,
  })

  const meetings = meetingsQuery.data ?? []
  const members = membersQuery.data?.records ?? []

  const groups = useMemo(() => {
    const live: WorkspaceMeeting[] = []
    const upcoming: WorkspaceMeeting[] = []
    const past: WorkspaceMeeting[] = []
    for (const meeting of meetings) {
      if (meeting.status === 'OPEN') live.push(meeting)
      else if (meeting.status === 'CLOSED') past.push(meeting)
      else upcoming.push(meeting)
    }
    live.sort((a, b) => meetingSortKey(b) - meetingSortKey(a))
    upcoming.sort((a, b) => meetingSortKey(a) - meetingSortKey(b))
    past.sort((a, b) => meetingSortKey(b) - meetingSortKey(a))
    return { live, upcoming, past }
  }, [meetings])

  const createMeeting = useMutation({
    mutationFn: () =>
      createWorkspaceMeeting(title.trim(), new Date(when).toISOString(), selected),
    onSuccess: async () => {
      toast.success(t('meeting.created'))
      setOpen(false)
      setTitle('')
      setWhen('')
      setSelected([])
      await queryClient.invalidateQueries({ queryKey: ['workspace-meetings', slug] })
      notifyHeaderNotificationsChanged()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? translateServerText(error.message) : t('meeting.createFailed')
      )
    },
  })

  /*
   * 分组卡：demo 的三层结构 ——
   *   头部行（图标 + 标题/描述 + 右侧计数胶囊）
   *   内容区（内层玻璃卡，两列栅格承载会议项）
   *   底部行（分隔线 + 次级说明）
   */
  const renderGroup = (
    sectionTitle: string,
    icon: typeof Video,
    items: WorkspaceMeeting[],
    desc: string,
    accent?: 'live'
  ) => {
    if (items.length === 0) return null
    const Icon = icon
    return (
      <section data-tilt='panel' className='a-glass rounded-[22px] p-4 sm:p-[18px]'>
        <div className='a-bcell__head'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-[9px]',
                accent === 'live' ? 'bg-success/15 text-success' : 'bg-accent-soft text-primary'
              )}
            >
              <Icon className='size-4' strokeWidth={1.9} aria-hidden />
            </span>
            <div className='min-w-0'>
              <h3 className='truncate'>{sectionTitle}</h3>
              <p className='mt-0.5 truncate text-[12.5px] text-text-secondary'>{desc}</p>
            </div>
          </div>
          <span className='a-tag shrink-0 font-mono tabular-nums'>
            {items.length}
          </span>
        </div>

        <ul className='grid gap-3 md:grid-cols-2'>
          {items.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              accent={accent}
              onEnter={() => {
                if (workspaceId) openMeetingWindow(meeting.id, workspaceId)
              }}
              onClose={() => {
                if (!workspaceId) return
                void closeWorkspaceMeeting(meeting.id, workspaceId).then(() => {
                  void queryClient.invalidateQueries({ queryKey: ['workspace-meetings', slug] })
                  notifyHeaderNotificationsChanged()
                })
              }}
            />
          ))}
        </ul>

        <div className='mt-3.5 flex items-center justify-between gap-3 border-t border-divider pt-3 text-[12px] text-text-muted'>
          <span className='truncate'>{t('meeting.groupFoot', { count: items.length })}</span>
        </div>
      </section>
    )
  }

  return (
    <>
      <HubPageShell
        eyebrow={t('meeting.eyebrow')}
        title={t('meeting.title')}
        description={t('meeting.pageDesc')}
        action={
          <Button
            type='button'
            className='a-btn a-btn--primary'
            onClick={() => setOpen(true)}
          >
            <Plus className='size-4' strokeWidth={2.1} />
            {t('meeting.create')}
          </Button>
        }
      >
        {meetingsQuery.isLoading ? <HubLoading /> : null}
        {!meetingsQuery.isLoading && meetings.length === 0 ? (
          <HubEmpty
            icon={Video}
            message={t('meeting.empty')}
            hint={t('meeting.createHint')}
            action={
              <Button
                type='button'
                className='a-btn a-btn--primary'
                onClick={() => setOpen(true)}
              >
                <Plus className='size-4' strokeWidth={2.1} />
                {t('meeting.create')}
              </Button>
            }
          />
        ) : null}
        {!meetingsQuery.isLoading && meetings.length > 0 ? (
          <div className='flex flex-col gap-[18px]'>
            {renderGroup(
              t('meeting.sectionLive'),
              Radio,
              groups.live,
              t('meeting.sectionLiveDesc'),
              'live'
            )}
            {renderGroup(
              t('meeting.sectionUpcoming'),
              CalendarClock,
              groups.upcoming,
              t('meeting.sectionUpcomingDesc')
            )}
            {renderGroup(
              t('meeting.sectionPast'),
              Video,
              groups.past,
              t('meeting.sectionPastDesc')
            )}
          </div>
        ) : null}
      </HubPageShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='gap-4 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('meeting.create')}</DialogTitle>
            <DialogDescription>{t('meeting.createHint')}</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-3'>
            <Input
              value={title}
              maxLength={200}
              placeholder={t('meeting.titlePlaceholder')}
              className='h-10 rounded-xl'
              onChange={(event) => setTitle(event.target.value)}
            />
            <label className='flex flex-col gap-1.5 text-xs font-medium text-muted-foreground'>
              {t('meeting.when')}
              <Input
                type='datetime-local'
                value={when}
                className='h-10 rounded-xl'
                onChange={(event) => setWhen(event.target.value)}
              />
            </label>
            <div className='flex flex-col max-h-56 overflow-auto rounded-xl border border-border/60 p-1 gap-1'>
              {members.map((member: WorkspaceMember) => {
                const checked = selected.includes(member.userId)
                const name = memberLabel(member)
                return (
                  <label
                    key={member.userId}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-hover',
                      checked && 'bg-accent-soft'
                    )}
                  >
                    <UserAvatar name={name} avatar={member.avatar} size={36} className='rounded-full' />
                    <span className='min-w-0 flex-1 truncate font-medium'>{name}</span>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        setSelected((current) =>
                          value === true
                            ? [...current, member.userId]
                            : current.filter((id) => id !== member.userId)
                        )
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              className='rounded-xl'
              disabled={
                createMeeting.isPending ||
                title.trim().length === 0 ||
                when.length === 0 ||
                selected.length === 0
              }
              onClick={() => createMeeting.mutate()}
            >
              {t('meeting.publish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MeetingCard({
  meeting,
  accent,
  onEnter,
  onClose,
}: {
  meeting: WorkspaceMeeting
  accent?: 'live'
  onEnter: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('board')
  const start = dayjs(meeting.startsAt)
  const today = dayjs()
  /** 时间块下方的日期副标：今天 / 明天 / 昨天 / 09-30（demo 版式） */
  const dayLabel = start.isSame(today, 'day')
    ? t('meeting.today')
    : start.isSame(today.add(1, 'day'), 'day')
      ? t('meeting.tomorrow')
      : start.isSame(today.subtract(1, 'day'), 'day')
        ? t('meeting.yesterday')
        : start.format('MM-DD')
  const joined = meeting.participantUserIds?.length ?? 0
  const elapsed = Math.max(0, dayjs().diff(start, 'minute'))
  const status =
    meeting.status === 'OPEN'
      ? {
          label: t('meeting.statusOpen'),
          tone: 'bg-success/15 text-success',
          dot: 'bg-success',
        }
      : meeting.status === 'CLOSED'
        ? {
            label: t('meeting.closed'),
            tone: 'bg-muted text-muted-foreground',
            dot: 'bg-muted-foreground/40',
          }
        : {
            label: t('meeting.statusScheduled'),
            tone: 'bg-warning/15 text-warning',
            dot: 'bg-warning',
          }

  return (
    <li
      data-tilt='row'
      className={cn(
        'group flex items-center gap-3.5 rounded-[16px] border border-divider bg-surface-secondary/60 p-3.5',
        'transition-[background-color,box-shadow] duration-200',
        'hover:bg-surface-hover hover:shadow-[var(--shadow-lg)]',
        accent === 'live' && 'border-success/25 bg-success/[0.06] hover:bg-success/[0.1]'
      )}
    >
      {/* 时间块：mono 大数 + 日期副标（demo 的左侧锚点） */}
      <div className='flex w-[62px] shrink-0 flex-col items-start gap-1'>
        <span className='font-mono text-[19px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-text-primary'>
          {start.format('HH:mm')}
        </span>
        <span className='font-mono text-[11px] font-medium tracking-wider tabular-nums text-text-muted'>
          {dayLabel}
        </span>
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <h3 className='truncate text-[14px] font-semibold tracking-[-0.02em] text-text-primary'>
            {meeting.title}
          </h3>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
              status.tone
            )}
          >
            <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden />
            {status.label}
          </span>
        </div>
        {/* demo 的元信息行：发起人 · N 人已加入 · 已进行 X 分钟 / 具体时间 */}
        <p className='mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-secondary'>
          {meeting.creatorName ? (
            <>
              <span className='truncate'>{t('meeting.by', { name: meeting.creatorName })}</span>
              <span aria-hidden className='text-text-muted'>
                ·
              </span>
            </>
          ) : null}
          <span className='tabular-nums'>{t('meeting.joined', { count: joined })}</span>
          <span aria-hidden className='text-text-muted'>
            ·
          </span>
          {meeting.status === 'OPEN' ? (
            <span className='tabular-nums'>{t('meeting.inProgress', { minutes: elapsed })}</span>
          ) : (
            <span className='font-mono tabular-nums'>{start.format('MM-DD HH:mm')}</span>
          )}
        </p>
      </div>

      <div className='flex shrink-0 items-center gap-1.5'>
        <Button
          type='button'
          className='a-btn a-btn--primary a-btn--sm'
          disabled={!meeting.canEnter}
          onClick={onEnter}
        >
          {meeting.status === 'CLOSED'
            ? t('meeting.closed')
            : meeting.canEnter
              ? t('meeting.enter')
              : t('meeting.notOpen')}
        </Button>
        {meeting.host && meeting.canEnter ? (
          <Button
            type='button'
            variant='secondary'
            className='a-btn a-btn--secondary a-btn--sm'
            onClick={onClose}
          >
            {t('meeting.close')}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export type { WorkspaceMeeting }
