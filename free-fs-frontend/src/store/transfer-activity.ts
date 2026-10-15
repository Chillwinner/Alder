/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

const ACTIVE_TRANSFER = new Set(['uploading', 'checking', 'merging'])
const UNFINISHED_TRANSFER = new Set([
  'idle',
  'initialized',
  'uploading',
  'checking',
  'merging',
  'paused',
])

export function hasActiveTransfer(tasks: Iterable<{ status: string }>): boolean {
  for (const task of tasks) {
    if (ACTIVE_TRANSFER.has(task.status)) return true
  }
  return false
}

export function hasUnfinishedTransfer(tasks: Iterable<{ status: string }>): boolean {
  for (const task of tasks) {
    if (UNFINISHED_TRANSFER.has(task.status)) return true
  }
  return false
}

export function listByStatus<T extends { status: string }>(tasks: Iterable<T>, statuses: string[]): T[] {
  const allowed = new Set(statuses)
  return Array.from(tasks).filter((task) => allowed.has(task.status))
}
