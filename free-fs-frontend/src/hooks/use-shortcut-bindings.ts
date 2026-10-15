/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  SHORTCUT_STORAGE_KEY,
  type KeyChord,
  type ShortcutId,
  eventMatchesChord,
  mergeShortcuts,
  parseStoredShortcuts,
} from '@/lib/shortcuts'

type ShortcutsContextValue = {
  bindings: Record<ShortcutId, KeyChord>
  recording: boolean
  setRecording: (next: boolean) => void
  setBinding: (id: ShortcutId, chord: KeyChord) => void
  resetBinding: (id: ShortcutId) => void
  resetAll: () => void
  matches: (event: KeyboardEvent, id: ShortcutId) => boolean
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

function readOverrides() {
  if (typeof window === 'undefined') return {}
  return parseStoredShortcuts(localStorage.getItem(SHORTCUT_STORAGE_KEY))
}

function persist(overrides: Partial<Record<ShortcutId, KeyChord>>) {
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(SHORTCUT_STORAGE_KEY)
    return
  }
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(overrides))
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState(readOverrides)
  const [recording, setRecording] = useState(false)
  const bindings = useMemo(() => mergeShortcuts(overrides), [overrides])

  const setBinding = useCallback((id: ShortcutId, chord: KeyChord) => {
    setOverrides((current) => {
      const next = { ...current, [id]: chord }
      persist(next)
      return next
    })
  }, [])

  const resetBinding = useCallback((id: ShortcutId) => {
    setOverrides((current) => {
      const next = { ...current }
      delete next[id]
      persist(next)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setOverrides({})
    persist({})
  }, [])

  const matches = useCallback(
    (event: KeyboardEvent, id: ShortcutId) => eventMatchesChord(event, bindings[id]),
    [bindings]
  )

  const value = useMemo(
    () => ({
      bindings,
      recording,
      setRecording,
      setBinding,
      resetBinding,
      resetAll,
      matches,
    }),
    [bindings, matches, recording, resetAll, resetBinding, setBinding]
  )

  return createElement(ShortcutsContext.Provider, { value }, children)
}

export function useShortcutBindings() {
  const ctx = useContext(ShortcutsContext)
  if (!ctx) {
    throw new Error('useShortcutBindings must be used within ShortcutsProvider')
  }
  return ctx
}

export function useOptionalShortcutBindings() {
  return useContext(ShortcutsContext)
}
