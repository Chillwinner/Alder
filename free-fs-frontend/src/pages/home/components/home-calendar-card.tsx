/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listCalendarEvents } from '@/api/calendar'
import { holidayOn, holidayName } from '@/lib/calendar-holidays-cn'
import { addDays, lunarDayName, startOfDay, ymd } from '@/lib/calendar-lunar'
import { cn } from '@/lib/utils'
import { HomeCalendarDialog } from './home-calendar-dialog'
import {
  CALENDAR_QUERY_KEY,
  CARD_PREVIEW_LIMIT,
  eventsOnDay,
  formatClock,
} from './home-calendar-utils'

export function HomeCalendarCard() {
  const { t, i18n } = useTranslation('home')
  const [open, setOpen] = useState(false)
  const todayKey = ymd(new Date())
  const today = useMemo(() => startOfDay(new Date()), [todayKey])
  const tomorrow = addDays(today, 1)
  const range = useMemo(
    () => ({
      from: today.toISOString(),
      to: addDays(today, 2).toISOString(),
    }),
    [today]
  )

  const eventsQuery = useQuery({
    queryKey: [CALENDAR_QUERY_KEY, range.from, range.to],
    queryFn: () => listCalendarEvents(range.from, range.to),
    staleTime: 15_000,
  })

  const events = eventsQuery.data ?? []
  const todayEvents = eventsOnDay(events, today)
  const visible = todayEvents.slice(0, CARD_PREVIEW_LIMIT)
  const hidden = Math.max(0, todayEvents.length - visible.length)
  const tomorrowEvents = eventsOnDay(events, tomorrow)
  const tomorrowHoliday = holidayOn(tomorrow)
  const tomorrowHint =
    tomorrowEvents[0]?.title ||
    (tomorrowHoliday ? holidayName(tomorrowHoliday, i18n.language) : '')
  const weekdayKeys = t('calendar.weekdaysLong', { returnObjects: true }) as string[]
  const weekday =
    Array.isArray(weekdayKeys) && weekdayKeys[today.getDay()]
      ? weekdayKeys[today.getDay()]
      : ''
  const lunar = lunarDayName(today)
  const todayHoliday = holidayOn(today)
  const dateTone =
    todayHoliday?.kind === 'statutory'
      ? 'text-[#e24b4a]'
      : todayHoliday?.kind === 'makeup'
        ? 'text-[#7eb8e8]'
        : 'text-foreground'

  return (
    <>
      <section
        data-tilt
        className='a-bcell glass-card h-full p-5'
        aria-label={t('calendar.title')}
      >
        <button
          type='button'
          className='flex h-full w-full min-h-0 flex-col gap-3 text-left'
          onClick={() => setOpen(true)}
        >
          <div className='flex items-end gap-2.5'>
            <span
              className={cn(
                'font-mono text-[40px] leading-none font-semibold tabular-nums tracking-tight',
                dateTone
              )}
            >
              {today.getDate()}
            </span>
            <div className='min-w-0 pb-0.5'>
              <p className='truncate text-[15px] font-medium text-foreground/80'>
                {t('calendar.lunarWeekday', { lunar, weekday })}
              </p>
              <p className='truncate text-[13px] text-foreground/65'>
                {t('calendar.tomorrow')}
                {tomorrow.getDate()}
                {tomorrowHint ? ` ${tomorrowHint}` : ''}
              </p>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              {todayHoliday
                ? holidayName(todayHoliday, i18n.language)
                : t('calendar.empty')}
            </p>
          ) : (
            <ul className='flex min-h-0 flex-col gap-1.5'>
              {visible.map((item) => (
                <li key={item.id} className='flex min-w-0 items-start gap-2'>
                  <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/70' />
                  <span className='min-w-0'>
                    <span className='block text-[11px] text-muted-foreground'>
                      {formatClock(new Date(item.startsAt), i18n.language)}
                    </span>
                    <span className='block truncate text-[13px]'>{item.title}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {hidden > 0 ? (
            <p className='mt-auto text-[11px] text-muted-foreground'>
              {t('calendar.more', { count: hidden })}
            </p>
          ) : null}
        </button>
      </section>
      <HomeCalendarDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
