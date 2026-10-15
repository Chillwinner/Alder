/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  addDays,
  gregorianOfLunar,
  lastLunarDayOfYear,
  ymd,
} from '@/lib/calendar-lunar'

export type HolidayKind = 'statutory' | 'festival' | 'makeup'

export type HolidayInfo = {
  kind: HolidayKind
  nameZh: string
  nameHk: string
  nameEn: string
  shortZh?: string
}

const FIXED: Record<string, HolidayInfo> = {
  '01-01': { kind: 'statutory', nameZh: '元旦', nameHk: '元旦', nameEn: 'New Year', shortZh: '元旦' },
  '02-14': { kind: 'festival', nameZh: '情人节', nameHk: '情人節', nameEn: "Valentine's Day" },
  '03-08': { kind: 'festival', nameZh: '妇女节', nameHk: '婦女節', nameEn: "Women's Day" },
  '03-12': { kind: 'festival', nameZh: '植树节', nameHk: '植樹節', nameEn: 'Arbor Day' },
  '04-01': { kind: 'festival', nameZh: '愚人节', nameHk: '愚人節', nameEn: "April Fools" },
  '05-01': { kind: 'statutory', nameZh: '劳动节', nameHk: '勞動節', nameEn: 'Labour Day', shortZh: '劳动' },
  '05-04': { kind: 'festival', nameZh: '青年节', nameHk: '青年節', nameEn: 'Youth Day' },
  '06-01': { kind: 'festival', nameZh: '儿童节', nameHk: '兒童節', nameEn: "Children's Day" },
  '07-01': { kind: 'festival', nameZh: '建党节', nameHk: '建黨節', nameEn: 'CPC Day' },
  '08-01': { kind: 'festival', nameZh: '建军节', nameHk: '建軍節', nameEn: 'Army Day' },
  '09-10': { kind: 'festival', nameZh: '教师节', nameHk: '教師節', nameEn: "Teachers' Day" },
  '10-01': { kind: 'statutory', nameZh: '国庆节', nameHk: '國慶節', nameEn: 'National Day', shortZh: '国庆' },
  '10-31': { kind: 'festival', nameZh: '万圣节', nameHk: '萬聖節', nameEn: 'Halloween' },
  '12-24': { kind: 'festival', nameZh: '平安夜', nameHk: '平安夜', nameEn: 'Christmas Eve' },
  '12-25': { kind: 'festival', nameZh: '圣诞节', nameHk: '聖誕節', nameEn: 'Christmas' },
}

const LUNAR_FESTIVALS: Array<{ month: number; day: number; info: HolidayInfo }> = [
  { month: 1, day: 1, info: { kind: 'statutory', nameZh: '春节', nameHk: '春節', nameEn: 'Spring Festival', shortZh: '春节' } },
  { month: 1, day: 15, info: { kind: 'festival', nameZh: '元宵节', nameHk: '元宵節', nameEn: 'Lantern Festival' } },
  { month: 5, day: 5, info: { kind: 'statutory', nameZh: '端午节', nameHk: '端午節', nameEn: 'Dragon Boat', shortZh: '端午' } },
  { month: 7, day: 7, info: { kind: 'festival', nameZh: '七夕', nameHk: '七夕', nameEn: 'Qixi' } },
  { month: 8, day: 15, info: { kind: 'statutory', nameZh: '中秋节', nameHk: '中秋節', nameEn: 'Mid-Autumn', shortZh: '中秋' } },
  { month: 9, day: 9, info: { kind: 'festival', nameZh: '重阳节', nameHk: '重陽節', nameEn: 'Double Ninth' } },
  { month: 12, day: 8, info: { kind: 'festival', nameZh: '腊八', nameHk: '臘八', nameEn: 'Laba' } },
  { month: 12, day: 23, info: { kind: 'festival', nameZh: '小年', nameHk: '小年', nameEn: 'Little New Year' } },
]

/** 国务院公布的连休日（2025）；2026–2027 按节日落点铺开常见连休。 */
const STATUTORY_SPANS: Array<{ start: string; end: string; info: HolidayInfo }> = [
  { start: '2025-01-01', end: '2025-01-01', info: FIXED['01-01'] },
  { start: '2025-01-28', end: '2025-02-04', info: { kind: 'statutory', nameZh: '春节', nameHk: '春節', nameEn: 'Spring Festival', shortZh: '春节' } },
  { start: '2025-04-04', end: '2025-04-06', info: { kind: 'statutory', nameZh: '清明节', nameHk: '清明節', nameEn: 'Qingming', shortZh: '清明' } },
  { start: '2025-05-01', end: '2025-05-05', info: FIXED['05-01'] },
  { start: '2025-05-31', end: '2025-06-02', info: { kind: 'statutory', nameZh: '端午节', nameHk: '端午節', nameEn: 'Dragon Boat', shortZh: '端午' } },
  { start: '2025-10-01', end: '2025-10-08', info: { kind: 'statutory', nameZh: '国庆节', nameHk: '國慶節', nameEn: 'National Day', shortZh: '国庆' } },
  { start: '2026-01-01', end: '2026-01-03', info: FIXED['01-01'] },
  { start: '2026-02-15', end: '2026-02-23', info: { kind: 'statutory', nameZh: '春节', nameHk: '春節', nameEn: 'Spring Festival', shortZh: '春节' } },
  { start: '2026-04-04', end: '2026-04-06', info: { kind: 'statutory', nameZh: '清明节', nameHk: '清明節', nameEn: 'Qingming', shortZh: '清明' } },
  { start: '2026-05-01', end: '2026-05-05', info: FIXED['05-01'] },
  { start: '2026-06-19', end: '2026-06-21', info: { kind: 'statutory', nameZh: '端午节', nameHk: '端午節', nameEn: 'Dragon Boat', shortZh: '端午' } },
  { start: '2026-09-25', end: '2026-09-27', info: { kind: 'statutory', nameZh: '中秋节', nameHk: '中秋節', nameEn: 'Mid-Autumn', shortZh: '中秋' } },
  { start: '2026-10-01', end: '2026-10-07', info: FIXED['10-01'] },
  { start: '2027-01-01', end: '2027-01-03', info: FIXED['01-01'] },
  { start: '2027-02-04', end: '2027-02-12', info: { kind: 'statutory', nameZh: '春节', nameHk: '春節', nameEn: 'Spring Festival', shortZh: '春节' } },
  { start: '2027-04-03', end: '2027-04-05', info: { kind: 'statutory', nameZh: '清明节', nameHk: '清明節', nameEn: 'Qingming', shortZh: '清明' } },
  { start: '2027-05-01', end: '2027-05-05', info: FIXED['05-01'] },
  { start: '2027-06-09', end: '2027-06-11', info: { kind: 'statutory', nameZh: '端午节', nameHk: '端午節', nameEn: 'Dragon Boat', shortZh: '端午' } },
  { start: '2027-09-15', end: '2027-09-17', info: { kind: 'statutory', nameZh: '中秋节', nameHk: '中秋節', nameEn: 'Mid-Autumn', shortZh: '中秋' } },
  { start: '2027-10-01', end: '2027-10-07', info: FIXED['10-01'] },
]

/** 国务院通知里的调休上班日（2025–2026 已公布；2027 尚未发文）。 */
const MAKEUP: HolidayInfo = {
  kind: 'makeup',
  nameZh: '调休',
  nameHk: '調休',
  nameEn: 'Workday',
}

const MAKEUP_DATES = [
  '2025-01-26',
  '2025-02-08',
  '2025-04-27',
  '2025-09-28',
  '2025-10-11',
  '2026-02-14',
  '2026-02-28',
  '2026-05-09',
  '2026-09-20',
  '2026-10-10',
]

const KIND_RANK: Record<HolidayKind, number> = {
  festival: 1,
  makeup: 2,
  statutory: 3,
}

const cache = new Map<number, Map<string, HolidayInfo>>()

function put(map: Map<string, HolidayInfo>, key: string, info: HolidayInfo) {
  const prev = map.get(key)
  if (!prev || KIND_RANK[info.kind] > KIND_RANK[prev.kind]) {
    map.set(key, info)
  }
}

function fillYear(year: number): Map<string, HolidayInfo> {
  const map = new Map<string, HolidayInfo>()
  for (const [md, info] of Object.entries(FIXED)) {
    put(map, `${year}-${md}`, info)
  }
  for (const row of LUNAR_FESTIVALS) {
    const date = gregorianOfLunar(year, row.month, row.day)
    if (date) put(map, ymd(date), row.info)
  }
  const eve = lastLunarDayOfYear(year)
  if (eve) {
    put(map, ymd(eve), {
      kind: 'festival',
      nameZh: '除夕',
      nameHk: '除夕',
      nameEn: "New Year's Eve",
    })
  }
  for (const span of STATUTORY_SPANS) {
    if (!span.start.startsWith(String(year))) continue
    let cursor = new Date(`${span.start}T00:00:00`)
    const end = new Date(`${span.end}T00:00:00`)
    while (cursor <= end) {
      put(map, ymd(cursor), span.info)
      cursor = addDays(cursor, 1)
    }
  }
  for (const day of MAKEUP_DATES) {
    if (day.startsWith(String(year))) put(map, day, MAKEUP)
  }
  return map
}

export function holidayOn(date: Date): HolidayInfo | undefined {
  const year = date.getFullYear()
  let yearMap = cache.get(year)
  if (!yearMap) {
    yearMap = fillYear(year)
    cache.set(year, yearMap)
  }
  return yearMap.get(ymd(date))
}

export function holidayName(info: HolidayInfo, lang: string): string {
  if (lang.startsWith('en')) return info.nameEn
  if (lang === 'zh-HK' || lang === 'zh-TW') return info.nameHk
  return info.nameZh
}

export function holidayShort(info: HolidayInfo, lang: string): string {
  if (info.kind === 'statutory' && info.shortZh && !lang.startsWith('en')) {
    return lang === 'zh-HK' || lang === 'zh-TW' ? info.nameHk.slice(0, 2) : info.shortZh
  }
  return holidayName(info, lang)
}

