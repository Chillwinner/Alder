/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, Vote } from 'lucide-react'
import { listPendingMeetings } from '@/api/meeting'
import { listPendingVotes } from '@/api/vote'

/**
 * 「待办」小卡 —— 首页三联卡空出来的第三格。
 *
 * 只用**真实待办**：
 *   · 待进入的会议   GET /apis/workspace-meetings/pending
 *   · 待表决的投票   GET /apis/workspace-votes/pending
 * 两者都是既有 API 封装，不新造接口、不改后端。
 *
 * ⚠️ **不要**给这两个请求加 hasPermission 判断。
 *    我一开始写了 hasPermission('meeting:read') / ('vote:read')，
 *    结果实测 sys_permission 表里**只有 5 个权限码**
 *    （file:read / file:write / file:share / storage:manage / member:manage），
 *    根本没有 meeting:* 与 vote:*。加判断会让卡片永远空着。
 *    顶栏的 use-header-notifications.ts 调这两个接口时同样没判权限。
 *
 * 版式与同排的另两张卡一致：label 行 / 中部大数字 / 底部说明行。
 */
export function HomeTodoCard() {
  const { t } = useTranslation('home')
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const meetings = useQuery({
    queryKey: ['home-todo', 'meetings', slug],
    queryFn: () => listPendingMeetings(),
    staleTime: 30_000,
  })

  const votes = useQuery({
    queryKey: ['home-todo', 'votes', slug],
    queryFn: () => listPendingVotes(),
    staleTime: 30_000,
  })

  const meetingCount = (meetings.data ?? []).length
  const voteCount = (votes.data ?? []).length
  const total = meetingCount + voteCount
  const isLoading = meetings.isLoading || votes.isLoading

  /* 没有待办：显示一行"暂无待办"，不留空白块 */
  if (!isLoading && total === 0) {
    return (
      <div className='hb-stat'>
        <div className='hb-stat__label'>
          <span>{t('todo.title')}</span>
          <span className='a-state-dot' />
        </div>
        <div className='min-w-0'>
          <div className='hb-stat__value'>
            <span className='hb-stat__num'>{t('todo.allClear')}</span>
          </div>
        </div>
        <div className='hb-stat__foot'>
          <span className='truncate'>{t('todo.meetings')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className='hb-stat'>
      <div className='hb-stat__label'>
        <span>{t('todo.title')}</span>
        <span
          className='a-state-dot a-state-dot--on'
          style={{ background: 'var(--warning)' }}
        />
      </div>

      <div className='min-w-0'>
        <div className='hb-stat__value'>
          <span className='hb-stat__num'>{isLoading ? '—' : total}</span>
          <span className='hb-stat__unit'>{t('storageCard.filesUnit')}</span>
        </div>

        <div className='hb-todo mt-3.5'>
          <button
            type='button'
            className='hb-todo__row'
            disabled={meetingCount === 0}
            onClick={() => navigate(`/w/${slug}/meetings`)}
          >
            <span className='hb-todo__ico hb-todo__ico--meeting'>
              <CalendarClock className='size-3.5' strokeWidth={1.9} />
            </span>
            <span className='hb-todo__name truncate'>{t('todo.meetings')}</span>
            <span className='hb-todo__num'>{isLoading ? '—' : meetingCount}</span>
          </button>

          <button
            type='button'
            className='hb-todo__row'
            disabled={voteCount === 0}
            onClick={() => navigate(`/w/${slug}/board`)}
          >
            <span className='hb-todo__ico hb-todo__ico--vote'>
              <Vote className='size-3.5' strokeWidth={1.9} />
            </span>
            <span className='hb-todo__name truncate'>{t('todo.votes')}</span>
            <span className='hb-todo__num'>{isLoading ? '—' : voteCount}</span>
          </button>
        </div>
      </div>

      <div className='hb-stat__foot'>
        <span className='truncate'>
          {meetingCount > 0
            ? t('todo.meetingsHint', { count: meetingCount })
            : t('todo.none')}
        </span>
      </div>
    </div>
  )
}
