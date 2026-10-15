/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { CalendarEvent } from '@/api/calendar'
import { addDays, startOfDay } from '@/lib/calendar-lunar'

export const CALENDAR_QUERY_KEY = 'calendar-events'
export const CARD_PREVIEW_LIMIT = 2
export const CELL_EVENT_LIMIT = 3
export const EVENT_DOTS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981']

export function eventDot(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % EVENT_DOTS.length
  return EVENT_DOTS[hash] ?? EVENT_DOTS[0]
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const start = startOfDay(day)
  const end = addDays(start, 1)
  return events
    .filter((item) => {
      const from = new Date(item.startsAt)
      const to = new Date(item.endsAt)
      return from < end && to > start
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

export function formatClock(date: Date, lang: string): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  if (lang.startsWith('en')) {
    const suffix = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    return minutes === 0 ? `${h} ${suffix}` : `${h}:${String(minutes).padStart(2, '0')} ${suffix}`
  }
  const period = hours < 12 ? '上午' : '下午'
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  if (minutes === 0) return `${period}${h}时`
  return `${period}${h}:${String(minutes).padStart(2, '0')}`
}

export function gregorianCellLabel(date: Date): string {
  if (date.getDate() === 1) return `${date.getMonth() + 1}月1日`
  return String(date.getDate())
}

export function combineDayTime(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0, 0, 0)
}

export function timeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
