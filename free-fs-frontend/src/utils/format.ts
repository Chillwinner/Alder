/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import dayjs from 'dayjs'

import type { HomeUsedBytesUnit } from '@/api/home'
import i18n from '@/i18n'

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.max(
    0,
    Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  )
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const FILE_SIZE_DETAIL_PATTERN =
  /((?:文件大小|file\s*size)\s*[:：]\s*)(\d+(?:\.\d+)?)(?![\d.]|\s*(?:B|KB|MB|GB|TB|PB|EB|ZB|YB)\b)/gi

/**
 * Format byte values embedded in operation-log details while preserving the
 * rest of the server-provided text.
 */
export function formatOperationLogDetail(detail?: string | null): string {
  if (!detail) return ''

  return detail.replace(
    FILE_SIZE_DETAIL_PATTERN,
    (_match, label: string, value: string) =>
      `${label}${formatFileSize(Number(value))}`
  )
}

const compactZh = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)

/**
 * 与首页存储图表纵轴/Tooltip 一致：万级及以上 KB/MB/GB 均用紧凑（如 2.16万）；
 * KB 未过万也保持紧凑；MB/GB 较小值按数量级保留小数。不做单位换算。
 */
export function formatHomeStorageNumber(
  value: number,
  unit: HomeUsedBytesUnit
): string {
  if (!Number.isFinite(value)) return ''
  if (value === 0) return '0'
  const abs = Math.abs(value)

  if (abs >= 10000) {
    return compactZh(value)
  }
  if (unit === 1) {
    return compactZh(value)
  }
  if (abs >= 100) {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }
  if (abs >= 1) {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
  }
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 0,
  }).format(value)
}

const HOME_STORAGE_UNIT_INDEX: Record<HomeUsedBytesUnit, number> = {
  1: 0,
  2: 1,
  3: 2,
}

const HOME_STORAGE_UNIT_LABELS = ['KB', 'MB', 'GB', 'TB']

function formatReadableStorageNumber(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 100) {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
  }
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 首页存储容量：自动换算到更合适的单位，避免出现“2.44万 MB” */
export function formatHomeStorageDisplay(
  value: number,
  unitLabel: string,
  storageUnit: HomeUsedBytesUnit
): string {
  if (!Number.isFinite(value)) return '—'
  let displayValue = value
  let unitIndex = HOME_STORAGE_UNIT_INDEX[storageUnit]

  while (
    Math.abs(displayValue) >= 1024 &&
    unitIndex < HOME_STORAGE_UNIT_LABELS.length - 1
  ) {
    displayValue /= 1024
    unitIndex += 1
  }

  const num = formatReadableStorageNumber(displayValue)
  const fallbackUnit = unitLabel.trim()
  const unit = HOME_STORAGE_UNIT_LABELS[unitIndex] || fallbackUnit
  return unit ? `${num} ${unit}` : num
}

export const formatDate = (
  date: string | number | Date,
  format = 'YYYY/MM/DD HH:mm:ss'
): string => {
  return dayjs(date).format(format)
}

export const formatFileTime = (date: string | number | Date): string => {
  return dayjs(date).format('YYYY/MM/DD HH:mm:ss')
}

/**
 * 格式化时间
 * 规则：
 * - 今天：显示"今天 HH:mm"
 * - 非今天：显示"YYYY/MM/DD HH:mm"
 *
 * @param dateStr 日期字符串或时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(dateStr: string | number | Date): string {
  const date = new Date(dateStr)
  const now = new Date()

  // 获取小时和分钟
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  // 判断是否是今天
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return i18n.t('common:format.todayTime', { time: timeStr })
  }

  // 非今天，显示完整日期 YYYY/MM/DD HH:mm
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}/${month}/${day} ${timeStr}`
}

/**
 * 文件列表行：日期与时间用「 | 」分隔，风格接近常见网盘列表
 */
export function formatFileListDisplayTime(
  dateStr: string | number | Date
): string {
  const date = new Date(dateStr)
  const now = new Date()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}`

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return i18n.t('common:format.todayListRow', { time: timeStr })
  }

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}/${month}/${day} | ${timeStr}`
}

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
