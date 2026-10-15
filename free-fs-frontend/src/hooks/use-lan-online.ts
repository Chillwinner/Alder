/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { lanOnlineMap } from '@/api/lan'
import { sseService } from '@/services/sse.service'

const watched = new Map<string, number>()
const listeners = new Set<() => void>()
let map: Record<string, boolean> = {}
let wired = false

function emit() {
  listeners.forEach((fn) => fn())
}

function applyPresence(userId: string, online: boolean) {
  if (!userId) return
  if (map[userId] === online) return
  map = { ...map, [userId]: online }
  emit()
}

async function snapshot() {
  const ids = [...watched.keys()]
  if (ids.length === 0) return
  try {
    const next = await lanOnlineMap(ids)
    const merged = { ...map }
    for (const id of ids) {
      merged[id] = Boolean(next[id])
    }
    map = merged
    emit()
  } catch {
    // keep last known map
  }
}

function wireSse() {
  if (wired) return
  wired = true
  sseService.onRawEvent((type, data) => {
    if (type !== 'lan_presence') return
    const userId = typeof data.userId === 'string' ? data.userId : ''
    applyPresence(userId, Boolean(data.online))
  })
  sseService.onConnectionChange((connected) => {
    if (connected) void snapshot()
  })
}

function watch(ids: string[]) {
  for (const id of ids) {
    watched.set(id, (watched.get(id) ?? 0) + 1)
  }
  wireSse()
  void snapshot()
  return () => {
    for (const id of ids) {
      const count = (watched.get(id) ?? 1) - 1
      if (count <= 0) watched.delete(id)
      else watched.set(id, count)
    }
  }
}

export function refreshLanOnline() {
  void snapshot()
}

export function useLanOnline(userIds: string[]) {
  const key = [...new Set(userIds.filter(Boolean))].sort().join(',')
  const [, setTick] = useState(0)

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) return undefined
    const onChange = () => setTick((n) => n + 1)
    listeners.add(onChange)
    const stop = watch(ids)
    return () => {
      listeners.delete(onChange)
      stop()
    }
  }, [key])

  return map
}
