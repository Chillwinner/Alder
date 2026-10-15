/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { workspaceApi } from '@/api/workspace'
import {
  createProgressTask,
  deleteProgressTask,
  reviewProgressTask,
  submitProgressTask,
  updateProgressTask,
  type ProgressKind,
  type ProgressStatus,
  type ProgressTask,
} from '@/api/progress'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { translateServerText } from '@/i18n'
import { useWorkspaceStore } from '@/store/workspace'

export function toLocalInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ymd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isOverdue(task: ProgressTask) {
  if (!task.dueAt || task.status === 'DONE' || task.status === 'REVIEW') return false
  return new Date(task.dueAt).getTime() < Date.now()
}

export function boardColumn(task: ProgressTask): ProgressStatus | 'OVERDUE' {
  if (isOverdue(task) && task.status === 'IN_PROGRESS') return 'OVERDUE'
  return task.status
}

export function DailyWeek({ week }: { week?: boolean[] | null }) {
  const { t } = useTranslation('progress')
  const days = week?.length === 7 ? week : Array.from({ length: 7 }, () => false)
  const today = new Date()
  return (
    <div className='pg-week' title={t('weekHint')}>
      {days.map((on, index) => {
        const date = new Date(today)
        date.setDate(today.getDate() - (6 - index))
        const isToday = index === 6
        return (
          <span key={index} className={`pg-week-cell${on ? ' on' : ''}${isToday ? ' today' : ''}`}>
            <i />
            <em>{isToday ? t('today') : date.getDate()}</em>
          </span>
        )
      })}
    </div>
  )
}

export function useProgressDialogs() {
  const { t } = useTranslation('progress')
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = useWorkspaceStore((s) => s.currentRole?.roleCode === 'admin')
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [createKind, setCreateKind] = useState<ProgressKind>('NORMAL')
  const [dueAt, setDueAt] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [editTask, setEditTask] = useState<ProgressTask | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editKind, setEditKind] = useState<ProgressKind>('NORMAL')
  const [editDue, setEditDue] = useState('')
  const [editStatus, setEditStatus] = useState<ProgressStatus>('IN_PROGRESS')
  const [editProgress, setEditProgress] = useState(0)
  const [editNote, setEditNote] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)

  const membersQuery = useQuery({
    queryKey: ['workspace-members', slug, 'progress'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 200 }),
    enabled: createOpen && isAdmin,
  })
  const members = membersQuery.data?.records ?? []

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['progress-tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['progress-month'] })
  }

  const createMut = useMutation({
    mutationFn: () =>
      createProgressTask({
        title: title.trim(),
        description: desc.trim() || undefined,
        kind: createKind,
        dueAt: createKind === 'NORMAL' && dueAt ? (dueAt.length === 16 ? `${dueAt}:00` : dueAt) : null,
        assigneeIds: isAdmin ? (assignees.length ? assignees : user?.id ? [user.id] : []) : user?.id ? [user.id] : [],
      }),
    onSuccess: () => {
      setCreateOpen(false)
      setTitle('')
      setDesc('')
      setAssignees([])
      setDueAt('')
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? translateServerText(error.message) : t('empty')),
  })

  const addImages = (list: File[]) => {
    const pics = list.filter((file) => file.type.startsWith('image/'))
    setImages((prev) => [...prev, ...pics].slice(0, 3))
  }

  const payload = () => ({
    description: editDesc,
    dueAt: editKind === 'NORMAL' && editDue ? (editDue.length === 16 ? `${editDue}:00` : editDue) : undefined,
    status: editStatus,
    progress: editKind === 'NORMAL' ? editProgress : undefined,
    note: editNote,
  })

  const saveMut = useMutation({
    mutationFn: async (review: boolean) => {
      if (!editTask) throw new Error('missing')
      if (images.length > 0 || review) {
        return submitProgressTask(editTask.id, images, { ...payload(), review })
      }
      return updateProgressTask(editTask.id, {
        description: editDesc,
        kind: editKind,
        status: editStatus,
        progress: editKind === 'NORMAL' ? editProgress : undefined,
        dueAt: payload().dueAt ?? null,
        note: editNote,
      })
    },
    onSuccess: () => {
      setEditTask(null)
      setImages([])
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? translateServerText(error.message) : t('empty')),
  })

  const deleteMut = useMutation({
    mutationFn: () => {
      if (!editTask) throw new Error('missing')
      return deleteProgressTask(editTask.id)
    },
    onSuccess: () => {
      setEditTask(null)
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? translateServerText(error.message) : t('empty')),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      reviewProgressTask(id, action),
    onSuccess: () => {
      setEditTask(null)
      invalidate()
    },
  })

  const openSubmit = (task: ProgressTask) => {
    setEditTask(task)
    setEditDesc(task.description ?? '')
    setEditKind(task.kind)
    setEditDue(toLocalInput(task.dueAt))
    setEditStatus(task.status === 'REVIEW' || task.status === 'DONE' ? task.status : task.status || 'IN_PROGRESS')
    setEditProgress(task.progress || 0)
    setEditNote(task.note ?? '')
    setImages([])
  }

  const dialogs = (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='text-xl'>{t('create')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <Input className='h-11 text-base' value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('name')} />
            <Input className='h-11 text-base' value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('desc')} />
            <select
              className='h-11 w-full rounded-md border bg-background px-3 text-base'
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value as ProgressKind)}
            >
              <option value='NORMAL'>{t('normal')}</option>
              <option value='DAILY'>{t('daily')}</option>
            </select>
            {createKind === 'NORMAL' ? (
              <Input className='h-11 text-base' type='datetime-local' value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            ) : null}
            {isAdmin ? (
              <div className='max-h-48 space-y-2 overflow-auto text-[15px]'>
                {members.map((member) => (
                  <label key={member.userId} className='flex items-center gap-3'>
                    <Checkbox
                      checked={assignees.includes(member.userId)}
                      onCheckedChange={(checked) =>
                        setAssignees((prev) =>
                          checked ? [...prev, member.userId] : prev.filter((id) => id !== member.userId)
                        )
                      }
                    />
                    {member.nickname || member.username}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button className='h-11 px-5' disabled={!title.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editTask)} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className='pg-editor sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-3 text-xl'>
              <span className='min-w-0 flex-1 truncate'>{editTask?.title}</span>
              {editTask?.createdBy === user?.id ? <span className='pg-chip'>{t('selfMade')}</span> : null}
            </DialogTitle>
          </DialogHeader>
          {editTask ? (
            <div className='space-y-4'>
              <dl className='pg-kv'>
                <div><dt>{t('assignees')}</dt><dd>{(editTask.assignees ?? []).map((a) => a.name).join('、') || '—'}</dd></div>
                <div><dt>{t('creator')}</dt><dd>{editTask.createdByName || editTask.createdBy}</dd></div>
                <div><dt>{t('createdAt')}</dt><dd>{editTask.createdAt ? new Date(editTask.createdAt).toLocaleString() : '—'}</dd></div>
                <div><dt>{t('updatedAt')}</dt><dd>{editTask.updatedAt ? new Date(editTask.updatedAt).toLocaleString() : '—'}</dd></div>
                <div><dt>{t('due')}</dt><dd>{editTask.dueAt ? new Date(editTask.dueAt).toLocaleString() : '—'}</dd></div>
              </dl>
              <label className='pg-field'>
                {t('desc')}
                <textarea
                  className='pg-area'
                  disabled={!editTask.canEdit}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={t('descHint')}
                  rows={3}
                />
              </label>
              {editKind === 'NORMAL' ? (
                <label className='pg-field'>
                  {t('progressAfter')}
                  <div className='flex items-center gap-3'>
                    <Input
                      className='h-11 w-28 text-base'
                      type='number'
                      min={0}
                      max={100}
                      disabled={!editTask.canEdit}
                      value={editProgress}
                      onChange={(e) => setEditProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    />
                    <span>%</span>
                  </div>
                </label>
              ) : (
                <DailyWeek week={editTask.week} />
              )}
              <div className='pg-field'>
                {t('photos')}
                <div
                  className={`pg-drop${dragOver ? ' is-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (editTask.canEdit) addImages(Array.from(e.dataTransfer.files ?? []))
                  }}
                >
                  {images.map((file, index) => (
                    <button
                      key={`${file.name}-${index}`}
                      type='button'
                      className='pg-thumb'
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <img src={URL.createObjectURL(file)} alt='' />
                    </button>
                  ))}
                  {images.length < 3 && editTask.canEdit ? (
                    <label className='pg-add'>
                      +
                      <input
                        type='file'
                        accept='image/*'
                        multiple
                        hidden
                        onChange={(e) => {
                          addImages(Array.from(e.target.files ?? []))
                          e.target.value = ''
                        }}
                      />
                    </label>
                  ) : null}
                </div>
                <p className='pg-meta'>{t('photoHint')}</p>
              </div>
              <label className='pg-field'>
                {t('kind')}
                <select
                  className='h-11 w-full rounded-md border bg-background px-3 text-base'
                  disabled={!editTask.canEdit}
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value as ProgressKind)}
                >
                  <option value='NORMAL'>{t('normalNeedDue')}</option>
                  <option value='DAILY'>{t('daily')}</option>
                </select>
              </label>
              {editKind === 'NORMAL' ? (
                <label className='pg-field'>
                  {t('due')}
                  <Input
                    className='h-11 text-base'
                    type='datetime-local'
                    disabled={!editTask.canEdit}
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                  />
                </label>
              ) : null}
              <label className='pg-field'>
                {t('status')}
                <select
                  className='h-11 w-full rounded-md border bg-background px-3 text-base'
                  disabled={!editTask.canEdit}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProgressStatus)}
                >
                  <option value='TODO'>{t('todo')}</option>
                  <option value='IN_PROGRESS'>{t('doing')}</option>
                  <option value='BLOCKED'>{t('blocked')}</option>
                </select>
              </label>
              <label className='pg-field'>
                {t('note')}
                <textarea
                  className='pg-area'
                  disabled={!editTask.canEdit}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={t('noteHint')}
                  rows={2}
                />
              </label>
            </div>
          ) : null}
          <DialogFooter className='flex-col items-stretch sm:flex-col'>
            {editTask?.canEdit ? (
              <div className='flex flex-wrap gap-2'>
                <Button className='h-11 px-5' disabled={saveMut.isPending} onClick={() => saveMut.mutate(false)}>
                  {t('save')}
                </Button>
                <Button
                  className='h-11 px-5'
                  variant='outline'
                  disabled={saveMut.isPending || images.length === 0}
                  onClick={() => saveMut.mutate(true)}
                >
                  {t('submitReview')}
                </Button>
              </div>
            ) : null}
            {editTask?.canReview ? (
              <div className='flex flex-wrap gap-2'>
                <Button className='h-11 px-5' onClick={() => reviewMut.mutate({ id: editTask.id, action: 'approve' })}>
                  {t('approve')}
                </Button>
                <Button className='h-11 px-5' variant='outline' onClick={() => reviewMut.mutate({ id: editTask.id, action: 'reject' })}>
                  {t('reject')}
                </Button>
              </div>
            ) : null}
            {editTask?.canDelete ? (
              <Button className='h-11 px-5' variant='outline' disabled={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
                {t('remove')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  return { isAdmin, createOpen, setCreateOpen, openSubmit, reviewMut, dialogs, t }
}

export function TaskActions({
  task,
  onSubmit,
  onReview,
}: {
  task: ProgressTask
  onSubmit: (task: ProgressTask) => void
  onReview: (id: string, action: 'approve' | 'reject') => void
}) {
  const { t } = useTranslation('progress')
  return (
    <div className='flex flex-wrap gap-2'>
      {task.canEdit || task.canSubmit ? (
        <Button className='h-10 px-4' variant='outline' onClick={() => onSubmit(task)}>
          {t('updateTask')}
        </Button>
      ) : null}
      {task.canReview ? (
        <>
          <Button className='h-10 px-4' onClick={() => onReview(task.id, 'approve')}>
            {t('approve')}
          </Button>
          <Button className='h-10 px-4' variant='outline' onClick={() => onReview(task.id, 'reject')}>
            {t('reject')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
