/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 1900–2100 农历压缩表（闰月位 + 各月大小），只用来算初几和农历节日。 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
]

const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

export type LunarDate = {
  year: number
  month: number
  day: number
  leap: boolean
}

function leapMonth(year: number) {
  return LUNAR_INFO[year - 1900] & 0xf
}

function leapDays(year: number) {
  if (leapMonth(year)) {
    return LUNAR_INFO[year - 1900] & 0x10000 ? 30 : 29
  }
  return 0
}

function monthDays(year: number, month: number) {
  return LUNAR_INFO[year - 1900] & (0x10000 >> month) ? 30 : 29
}

function yearDays(year: number) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += LUNAR_INFO[year - 1900] & i ? 1 : 0
  }
  return sum + leapDays(year)
}

function offsetFrom1900(date: Date) {
  const base = Date.UTC(1900, 0, 31)
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((utc - base) / 86400000)
}

export function toLunar(date: Date): LunarDate | null {
  let offset = offsetFrom1900(date)
  if (offset < 0) return null
  let year = 1900
  for (; year < 2101 && offset > 0; year++) {
    const days = yearDays(year)
    if (offset < days) break
    offset -= days
  }
  if (year > 2100) return null
  const leap = leapMonth(year)
  let month = 1
  let isLeap = false
  for (; month < 13 && offset > 0; month++) {
    let days: number
    if (leap > 0 && month === leap + 1 && !isLeap) {
      month--
      isLeap = true
      days = leapDays(year)
    } else {
      days = monthDays(year, month)
    }
    if (offset < days) break
    offset -= days
    if (isLeap && month === leap + 1) isLeap = false
  }
  return { year, month, day: offset + 1, leap: isLeap }
}

const LUNAR_MONTHS = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '腊月',
]

export function lunarDayName(date: Date): string {
  const lunar = toLunar(date)
  if (!lunar) return ''
  return DAY_NAMES[lunar.day - 1] ?? ''
}

/** Mac 月历格右侧：初一写成「九月初一」，其余只写初几。 */
export function lunarCellCaption(date: Date): string {
  const lunar = toLunar(date)
  if (!lunar) return ''
  const day = DAY_NAMES[lunar.day - 1] ?? ''
  if (lunar.day !== 1) return day
  const month = LUNAR_MONTHS[lunar.month - 1] ?? ''
  return `${lunar.leap ? '闰' : ''}${month}${day}`
}

export function gregorianOfLunar(
  year: number,
  month: number,
  day: number
): Date | null {
  for (let cursor = new Date(year, 0, 20); cursor.getFullYear() <= year + 1; ) {
    const lunar = toLunar(cursor)
    if (
      lunar &&
      !lunar.leap &&
      lunar.year === year &&
      lunar.month === month &&
      lunar.day === day
    ) {
      return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    if (cursor.getFullYear() > year + 1) break
  }
  return null
}

export function lastLunarDayOfYear(year: number): Date | null {
  const nextSpring = gregorianOfLunar(year + 1, 1, 1)
  if (!nextSpring) return null
  return new Date(nextSpring.getFullYear(), nextSpring.getMonth(), nextSpring.getDate() - 1)
}

export function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
