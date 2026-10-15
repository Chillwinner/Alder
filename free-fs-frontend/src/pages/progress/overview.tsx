/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { listProgressTasks, type ProgressStatus, type ProgressTask } from '@/api/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HubEmpty, HubLoading } from '@/components/collab/hub-shell'
import { ListTodo } from 'lucide-react'
import { boardColumn, DailyWeek, TaskActions, useProgressDialogs, ymd } from './shared'

const COLS: { key: ProgressStatus | 'OVERDUE'; label: 'todo' | 'doing' | 'overdue' | 'review' | 'blocked' | 'done' }[] = [
  { key: 'TODO', label: 'todo' },
  { key: 'IN_PROGRESS', label: 'doing' },
  { key: 'OVERDUE', label: 'overdue' },
  { key: 'REVIEW', label: 'review' },
  { key: 'BLOCKED', label: 'blocked' },
  { key: 'DONE', label: 'done' },
]

export default function ProgressOverview() {
  const { t } = useTranslation('progress')
  const { slug = '' } = useParams()
  const dialogs = useProgressDialogs()
  const [view, setView] = useState<'list' | 'board'>('board')
  const [date, setDate] = useState(ymd(new Date()))
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')

  const listQuery = useQuery({
    queryKey: ['progress-tasks', slug, 'all', date, keyword, kind, status],
    queryFn: () =>
      listProgressTasks({
        scope: 'all',
        date,
        keyword: keyword || undefined,
        kind: kind || undefined,
        status: status || undefined,
      }),
  })
  const tasks = listQuery.data ?? []
  const grouped = useMemo(() => {
    const map = new Map<string, ProgressTask[]>()
    for (const col of COLS) map.set(col.key, [])
    for (const task of tasks) {
      const key = boardColumn(task)
      map.get(key)?.push(task)
    }
    return map
  }, [tasks])

  return (
    <>
      <div className='pg-head'>
        <div>
          <h1>{t('overview')}</h1>
          <p className='pg-sub'>{t('overviewHint')}</p>
        </div>
        <Button className='h-11 px-5 text-base' onClick={() => dialogs.setCreateOpen(true)}>
          <Plus className='size-4' />
          {t('create')}
        </Button>
      </div>

      <div className='pg-toolbar'>
        <Button variant={view === 'list' ? 'default' : 'outline'} className='h-11 px-4' onClick={() => setView('list')}>
          {t('listView')}
        </Button>
        <Button variant={view === 'board' ? 'default' : 'outline'} className='h-11 px-4' onClick={() => setView('board')}>
          {t('boardView')}
        </Button>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='outline'
            className='h-11 w-11'
            onClick={() => {
              const next = new Date(`${date}T12:00:00`)
              next.setDate(next.getDate() - 1)
              setDate(ymd(next))
            }}
          >
            <ChevronLeft className='size-5' />
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-11 min-w-36 px-3 text-base'
            onClick={() => setDate(ymd(new Date()))}
          >
            {date === ymd(new Date())
              ? t('today')
              : t('dayLabel', { month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) })}
          </Button>
          <Button
            type='button'
            variant='outline'
            className='h-11 w-11'
            onClick={() => {
              const next = new Date(`${date}T12:00:00`)
              next.setDate(next.getDate() + 1)
              setDate(ymd(next))
            }}
          >
            <ChevronRight className='size-5' />
          </Button>
        </div>
        <Input className='h-11 w-56 text-base' value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('keyword')} />
        <select className='h-11 rounded-md border bg-background px-3 text-base' value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value=''>{t('allKind')}</option>
          <option value='DAILY'>{t('daily')}</option>
          <option value='NORMAL'>{t('normal')}</option>
        </select>
        <select className='h-11 rounded-md border bg-background px-3 text-base' value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value=''>{t('allStatus')}</option>
          <option value='TODO'>{t('todo')}</option>
          <option value='IN_PROGRESS'>{t('doing')}</option>
          <option value='BLOCKED'>{t('blocked')}</option>
          <option value='REVIEW'>{t('review')}</option>
          <option value='DONE'>{t('done')}</option>
        </select>
      </div>

      {listQuery.isLoading ? (
        <HubLoading />
      ) : tasks.length === 0 ? (
        <HubEmpty icon={ListTodo} message={t('empty')} />
      ) : view === 'board' ? (
        <div className='pg-board'>
          {COLS.map((col) => {
            const items = grouped.get(col.key) ?? []
            return (
              <section key={col.key} className='pg-col'>
                <h3>
                  {t(col.label)} <span>{items.length}</span>
                </h3>
                {items.map((task) => (
                  <article key={task.id} className='pg-card cursor-pointer' onClick={() => dialogs.openSubmit(task)}>
                    <h4>{task.title}</h4>
                    <p className='pg-meta'>
                      {(task.assignees ?? []).map((a) => a.name).join('、') || '—'}
                      {task.dueAt ? ` · ${new Date(task.dueAt).toLocaleDateString()}` : ''}
                    </p>
                    {task.kind === 'NORMAL' ? (
                      <>
                        <div className='pg-bar'>
                          <i style={{ width: `${task.progress ?? 0}%` }} />
                        </div>
                        <p className='pg-meta'>{task.progress ?? 0}%</p>
                      </>
                    ) : (
                      <DailyWeek week={task.week} />
                    )}
                    <div className='mt-3' onClick={(e) => e.stopPropagation()}>
                      <TaskActions task={task} onSubmit={dialogs.openSubmit} onReview={(id, action) => dialogs.reviewMut.mutate({ id, action })} />
                    </div>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      ) : (
        <div className='pg-list'>
          {tasks.map((task) => (
            <div key={task.id} className='pg-row cursor-pointer' onClick={() => dialogs.openSubmit(task)}>
              <div>
                <div className='text-[17px] font-semibold'>{task.title}</div>
                <div className='pg-meta mt-1'>{task.description}</div>
              </div>
              <div>{task.kind === 'DAILY' ? t('daily') : t('normal')}</div>
              <div>
                {task.kind === 'NORMAL' ? (
                  <>
                    <div className='pg-bar'>
                      <i style={{ width: `${task.progress ?? 0}%` }} />
                    </div>
                    <span className='pg-meta'>{task.progress ?? 0}%</span>
                  </>
                ) : (
                  <DailyWeek week={task.week} />
                )}
              </div>
              <div className='pg-meta'>{(task.assignees ?? []).map((a) => a.name).join('、')}</div>
              <div>{t(task.status === 'TODO' ? 'todo' : task.status === 'IN_PROGRESS' ? 'doing' : task.status === 'BLOCKED' ? 'blocked' : task.status === 'REVIEW' ? 'review' : 'done')}</div>
              <div onClick={(e) => e.stopPropagation()}>
                <TaskActions task={task} onSubmit={dialogs.openSubmit} onReview={(id, action) => dialogs.reviewMut.mutate({ id, action })} />
              </div>
            </div>
          ))}
        </div>
      )}
      {dialogs.dialogs}
    </>
  )
}
