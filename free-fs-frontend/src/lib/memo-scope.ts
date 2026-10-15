/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useState } from 'react'
import type { MemoVisibility } from '@/types/workspace-board'

const STORAGE_PREFIX = 'memo-visibility-scope-v1'

function storageKey(workspaceKey: string) {
  return `${STORAGE_PREFIX}:${workspaceKey || 'default'}`
}

export function readMemoScope(
  workspaceKey: string,
  fallback: MemoVisibility = 'shared'
): MemoVisibility {
  try {
    const raw = localStorage.getItem(storageKey(workspaceKey))
    if (raw === 'private' || raw === 'shared') return raw
  } catch {
    // private mode
  }
  return fallback
}

export function writeMemoScope(workspaceKey: string, scope: MemoVisibility) {
  try {
    localStorage.setItem(storageKey(workspaceKey), scope)
  } catch {
    // quota / private mode
  }
}

export function usePersistedMemoScope(
  workspaceKey: string,
  fallback: MemoVisibility = 'shared'
) {
  const [scope, setScopeState] = useState<MemoVisibility>(() =>
    readMemoScope(workspaceKey, fallback)
  )

  useEffect(() => {
    setScopeState(readMemoScope(workspaceKey, fallback))
  }, [workspaceKey, fallback])

  const setScope = useCallback(
    (next: MemoVisibility) => {
      writeMemoScope(workspaceKey, next)
      setScopeState(next)
    },
    [workspaceKey]
  )

  return [scope, setScope] as const
}
