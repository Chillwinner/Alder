/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
} from '@/api/calendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { holidayName, holidayOn } from '@/lib/calendar-holidays-cn'
import { addDays, lunarCellCaption, startOfDay, ymd } from '@/lib/calendar-lunar'
import { cn } from '@/lib/utils'
import {
  CALENDAR_QUERY_KEY,
  CELL_EVENT_LIMIT,
  combineDayTime,
  eventDot,
  eventsOnDay,
  formatClock,
  gregorianCellLabel,
  monthGrid,
  timeInputValue,
} from './home-calendar-utils'

const MAC_CAL_STYLE = `
.mac-cal { display: flex; flex-direction: column; height: min(86vh, 820px); min-height: 560px; background: var(--card); }
.mac-cal__bar { display: flex; align-items: center; justify-content: space-between; padding: 18px 92px 10px 22px; }
.mac-cal__title { font: 400 28px/1.15 var(--font-sans); letter-spacing: -0.03em; color: var(--foreground); }
.mac-cal__nav { display: flex; align-items: center; gap: 8px; }
.mac-cal__week { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border); }
.mac-cal__wd { padding: 8px 0 7px; text-align: center; font: 400 12px/1 var(--font-sans); color: var(--text-muted); }
.mac-cal__grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, 1fr); min-height: 0; }
.mac-cal__cell { display: flex; flex-direction: column; min-width: 0; min-height: 0; padding: 6px 8px 4px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); text-align: left; background: transparent; color: inherit; }
.mac-cal__cell:nth-child(7n) { border-right: none; }
.mac-cal__head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.mac-cal__num { font: 500 16px/1 var(--font-sans); color: var(--foreground); }
.mac-cal__lunar { font: 500 14px/1 var(--font-sans); color: color-mix(in srgb, var(--foreground) 72%, var(--text-secondary)); }
.mac-cal__cell--out .mac-cal__num,
.mac-cal__cell--out .mac-cal__lunar { color: color-mix(in srgb, var(--foreground) 38%, transparent); }
.mac-cal__today { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border-radius: 99px; background: #e24b4a; color: #fff; font: 600 16px/1 var(--font-sans); }
.mac-cal__events { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; min-height: 0; overflow: hidden; }
.mac-cal__holiday { font: 400 11px/1.35 var(--font-sans); color: #e24b4a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mac-cal__fest { font: 400 11px/1.35 var(--font-sans); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mac-cal__makeup { font: 400 11px/1.35 var(--font-sans); color: #3b6fd4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mac-cal__ev { display: flex; align-items: center; gap: 5px; min-width: 0; border: 0; background: transparent; padding: 0; text-align: left; color: inherit; cursor: pointer; }
.mac-cal__dot { width: 6px; height: 6px; border-radius: 99px; flex-shrink: 0; }
.mac-cal__ev-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 400 11px/1.35 var(--font-sans); color: var(--foreground); }
.mac-cal__more { font: 400 11px/1.3 var(--font-sans); color: var(--text-muted); padding-left: 11px; }
`

type HomeCalendarDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HomeCalendarDialog({ open, onOpenChange }: HomeCalendarDialogProps) {
  const { t, i18n } = useTranslation('home')
  const queryClient = useQueryClient()
  const today = startOfDay(new Date())
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date | null>(null)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  const range = useMemo(() => {
    const from = addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), -7)
    const to = addDays(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), 14)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [cursor])

  const eventsQuery = useQuery({
    queryKey: [CALENDAR_QUERY_KEY, range.from, range.to],
    queryFn: () => listCalendarEvents(range.from, range.to),
    enabled: open,
    staleTime: 15_000,
  })

  const events = eventsQuery.data ?? []
  const cells = monthGrid(cursor.getFullYear(), cursor.getMonth())
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[]
  const lang = i18n.language

  const resetForm = (event: CalendarEvent | null = null) => {
    setEditing(event)
    if (event) {
      setTitle(event.title)
      setNote(event.note ?? '')
      setStartTime(timeInputValue(new Date(event.startsAt)))
      setEndTime(timeInputValue(new Date(event.endsAt)))
      return
    }
    setTitle('')
    setNote('')
    setStartTime('09:00')
    setEndTime('10:00')
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CALENDAR_QUERY_KEY] })

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) return
      const startsAt = combineDayTime(selected, startTime).toISOString()
      const endsAt = combineDayTime(selected, endTime).toISOString()
      const body = { title: title.trim(), note: note.trim() || undefined, startsAt, endsAt }
      if (editing) return updateCalendarEvent(editing.id, body)
      return createCalendarEvent(body)
    },
    onSuccess: () => {
      resetForm()
      void invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => {
      resetForm()
      void invalidate()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex w-[min(1120px,calc(100%-20px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'>
        <style>{MAC_CAL_STYLE}</style>
        <DialogTitle className='sr-only'>{t('calendar.title')}</DialogTitle>
        <DialogDescription className='sr-only'>{t('calendar.dialogDesc')}</DialogDescription>
        <div className='mac-cal'>
          <div className='mac-cal__bar'>
            <h2 className='mac-cal__title'>
              {t('calendar.monthTitle', {
                year: cursor.getFullYear(),
                month: cursor.getMonth() + 1,
              })}
            </h2>
            <div className='mac-cal__nav'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-8'
                onClick={() => {
                  setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
                  setSelected(null)
                  resetForm()
                }}
              >
                {t('calendar.today')}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8'
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className='size-4' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8'
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
          <div className='mac-cal__week'>
            {(Array.isArray(weekdays) ? weekdays : []).map((label, index) => (
              <div key={`${label}-${index}`} className='mac-cal__wd'>
                {label}
              </div>
            ))}
          </div>
          <div className='mac-cal__grid'>
            {cells.map((cell) => {
              const inMonth = cell.getMonth() === cursor.getMonth()
              const isToday = ymd(cell) === ymd(today)
              const isOpen = selected != null && ymd(cell) === ymd(selected)
              const holiday = holidayOn(cell)
              const dayEvents = eventsOnDay(events, cell)
              const shown = dayEvents.slice(0, holiday ? CELL_EVENT_LIMIT - 1 : CELL_EVENT_LIMIT)
              const extra = dayEvents.length - shown.length
              return (
                <Popover
                  key={ymd(cell)}
                  open={isOpen}
                  onOpenChange={(next) => {
                    if (next) {
                      setSelected(cell)
                      resetForm()
                    } else if (isOpen) {
                      setSelected(null)
                      resetForm()
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type='button'
                      className={cn('mac-cal__cell', !inMonth && 'mac-cal__cell--out')}
                    >
                      <div className='mac-cal__head'>
                        {isToday ? (
                          <span className='mac-cal__today'>{cell.getDate()}</span>
                        ) : (
                          <span className='mac-cal__num'>{gregorianCellLabel(cell)}</span>
                        )}
                        <span className='mac-cal__lunar'>{lunarCellCaption(cell)}</span>
                      </div>
                      <div className='mac-cal__events'>
                        {holiday ? (
                          <span
                            className={
                              holiday.kind === 'statutory'
                                ? 'mac-cal__holiday'
                                : holiday.kind === 'makeup'
                                  ? 'mac-cal__makeup'
                                  : 'mac-cal__fest'
                            }
                          >
                            {holidayName(holiday, lang)}
                          </span>
                        ) : null}
                        {shown.map((item) => (
                          <span
                            key={item.id}
                            className='mac-cal__ev'
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              setSelected(cell)
                              resetForm(item)
                            }}
                          >
                            <i
                              className='mac-cal__dot'
                              style={{ background: eventDot(item.id) }}
                            />
                            <span className='mac-cal__ev-text'>
                              {formatClock(new Date(item.startsAt), lang)} {item.title}
                            </span>
                          </span>
                        ))}
                        {extra > 0 ? (
                          <span className='mac-cal__more'>
                            {t('calendar.moreInCell', { count: extra })}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align='start' className='w-80'>
                    <form
                      className='flex flex-col gap-2'
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (!title.trim()) return
                        save.mutate()
                      }}
                    >
                      <p className='text-xs text-muted-foreground'>
                        {editing ? t('calendar.editEvent') : t('calendar.newEvent')}
                        {' · '}
                        {cell.getMonth() + 1}/{cell.getDate()}
                      </p>
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={t('calendar.titleLabel')}
                        maxLength={200}
                      />
                      <div className='grid grid-cols-2 gap-2'>
                        <label className='text-xs text-muted-foreground'>
                          {t('calendar.start')}
                          <Input
                            type='time'
                            className='mt-1'
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                          />
                        </label>
                        <label className='text-xs text-muted-foreground'>
                          {t('calendar.end')}
                          <Input
                            type='time'
                            className='mt-1'
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                          />
                        </label>
                      </div>
                      <Input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={t('calendar.note')}
                        maxLength={2000}
                      />
                      <div className='flex gap-2'>
                        <Button type='submit' className='flex-1' disabled={save.isPending}>
                          {t('calendar.save')}
                        </Button>
                        {editing ? (
                          <Button
                            type='button'
                            variant='destructive'
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(editing.id)}
                          >
                            {t('calendar.delete')}
                          </Button>
                        ) : null}
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
