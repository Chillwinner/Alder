/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listProgressTasks, type ProgressStatus } from '@/api/progress'
import { Button } from '@/components/ui/button'
import { HubEmpty, HubLoading } from '@/components/collab/hub-shell'
import { ListTodo } from 'lucide-react'
import { DailyWeek, TaskActions, useProgressDialogs } from './shared'

const TABS: { key: '' | ProgressStatus; label: 'doing' | 'review' | 'done' | 'allMine' }[] = [
  { key: 'IN_PROGRESS', label: 'doing' },
  { key: 'REVIEW', label: 'review' },
  { key: 'DONE', label: 'done' },
  { key: '', label: 'allMine' },
]

export default function ProgressMine() {
  const { t } = useTranslation('progress')
  const { slug = '' } = useParams()
  const dialogs = useProgressDialogs()
  const [tab, setTab] = useState<'' | ProgressStatus>('IN_PROGRESS')

  const listQuery = useQuery({
    queryKey: ['progress-tasks', slug, 'mine', tab],
    queryFn: () => listProgressTasks({ scope: 'mine', status: tab || undefined }),
  })
  const tasks = listQuery.data ?? []

  return (
    <>
      <div className='pg-head'>
        <div>
          <h1>{t('mine')}</h1>
          <p className='pg-sub'>{t('mineHint')}</p>
        </div>
        <Button className='h-11 px-5 text-base' onClick={() => dialogs.setCreateOpen(true)}>
          <Plus className='size-4' />
          {t('create')}
        </Button>
      </div>
      <div className='pg-toolbar'>
        {TABS.map((item) => (
          <Button
            key={item.label}
            className='h-11 px-5 text-base'
            variant={tab === item.key ? 'default' : 'outline'}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
          </Button>
        ))}
      </div>
      {listQuery.isLoading ? (
        <HubLoading />
      ) : tasks.length === 0 ? (
        <HubEmpty icon={ListTodo} message={t('empty')} />
      ) : (
        <div className='pg-mine'>
          {tasks.map((task) => (
            <article key={task.id} className='pg-mine-card cursor-pointer' onClick={() => dialogs.openSubmit(task)}>
              <div className='mb-5 flex items-start justify-between gap-4'>
                <div>
                  <h3>{task.title}</h3>
                  <p className='pg-meta mt-2'>
                    {task.kind === 'DAILY' ? t('daily') : t('normal')}
                    {task.dueAt ? ` · ${t('due')} ${new Date(task.dueAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <TaskActions task={task} onSubmit={dialogs.openSubmit} onReview={(id, action) => dialogs.reviewMut.mutate({ id, action })} />
                </div>
              </div>
              {task.kind === 'NORMAL' ? (
                <>
                  <div className='pg-bar !h-2.5'>
                    <i style={{ width: `${task.progress ?? 0}%` }} />
                  </div>
                  <p className='mt-2 text-base tabular-nums'>{task.progress ?? 0}%</p>
                </>
              ) : (
                <DailyWeek week={task.week} />
              )}
              {task.description ? <p className='mt-4 text-[15px] text-muted-foreground'>{task.description}</p> : null}
            </article>
          ))}
        </div>
      )}
      {dialogs.dialogs}
    </>
  )
}
