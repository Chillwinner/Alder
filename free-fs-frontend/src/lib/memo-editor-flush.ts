/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

const flushers = new Map<string, () => Promise<void>>()
const ownEventUntil = new Map<string, number>()

export function registerMemoFlush(memoId: string, flush: () => Promise<void>) {
  flushers.set(memoId, flush)
  return () => {
    if (flushers.get(memoId) === flush) flushers.delete(memoId)
  }
}

/** 自己刚提交的 SSE 回声不要当成「别人覆盖了正文」。 */
export function expectOwnMemoEvent(memoId: string) {
  ownEventUntil.set(memoId, Date.now() + 5000)
}

export function cancelOwnMemoEvent(memoId: string) {
  ownEventUntil.delete(memoId)
}

export function consumeOwnMemoEvent(memoId: string) {
  const until = ownEventUntil.get(memoId) ?? 0
  ownEventUntil.delete(memoId)
  return until > Date.now()
}

export async function flushMemoEditor(memoId: string) {
  const flush = flushers.get(memoId)
  if (!flush) return
  expectOwnMemoEvent(memoId)
  try {
    await flush()
  } catch (error) {
    cancelOwnMemoEvent(memoId)
    throw error
  }
}
