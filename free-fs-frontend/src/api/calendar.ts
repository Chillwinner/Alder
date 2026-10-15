/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export type CalendarEvent = {
  id: string
  title: string
  note?: string | null
  startsAt: string
  endsAt: string
}

export type SaveCalendarEvent = {
  title: string
  note?: string
  startsAt: string
  endsAt: string
}

export function listCalendarEvents(from: string, to: string) {
  return request.get<CalendarEvent[]>('/apis/calendar/events', {
    params: { from, to },
  })
}

export function createCalendarEvent(body: SaveCalendarEvent) {
  return request.post<CalendarEvent>('/apis/calendar/events', body)
}

export function updateCalendarEvent(id: string, body: SaveCalendarEvent) {
  return request.put<CalendarEvent>(`/apis/calendar/events/${id}`, body)
}

export function deleteCalendarEvent(id: string) {
  return request.delete<void>(`/apis/calendar/events/${id}`)
}
