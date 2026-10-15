/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export const SHORTCUT_STORAGE_KEY = 'alder-shortcuts-v1'

export type ShortcutId =
  | 'commandPalette'
  | 'toggleSidebar'
  | 'openMessages'
  | 'openSettings'
  | 'help'
  | 'filesCopy'
  | 'filesPaste'
  | 'filesRename'
  | 'filesDownload'
  | 'filesDelete'
  | 'filesNewFolder'
  | 'filesFavorite'
  | 'boardNewMemo'

export type ShortcutGroup = 'global' | 'files' | 'board'

export type KeyChord = {
  key: string
  mod?: boolean
  shift?: boolean
  alt?: boolean
}

export const SHORTCUT_META: {
  id: ShortcutId
  group: ShortcutGroup
}[] = [
  { id: 'commandPalette', group: 'global' },
  { id: 'toggleSidebar', group: 'global' },
  { id: 'openMessages', group: 'global' },
  { id: 'openSettings', group: 'global' },
  { id: 'help', group: 'global' },
  { id: 'filesCopy', group: 'files' },
  { id: 'filesPaste', group: 'files' },
  { id: 'filesRename', group: 'files' },
  { id: 'filesDownload', group: 'files' },
  { id: 'filesDelete', group: 'files' },
  { id: 'filesNewFolder', group: 'files' },
  { id: 'filesFavorite', group: 'files' },
  { id: 'boardNewMemo', group: 'board' },
]

export const DEFAULT_SHORTCUTS: Record<ShortcutId, KeyChord> = {
  commandPalette: { key: 'k', mod: true },
  toggleSidebar: { key: 'b', mod: true },
  openMessages: { key: 'm', mod: true, shift: true },
  openSettings: { key: ',', mod: true },
  help: { key: '?' },
  filesCopy: { key: 'c', mod: true },
  filesPaste: { key: 'v', mod: true },
  filesRename: { key: 'F2' },
  filesDownload: { key: 'd', mod: true, shift: true },
  filesDelete: { key: 'Backspace' },
  filesNewFolder: { key: 'n', mod: true, shift: true },
  filesFavorite: { key: 's', mod: true, shift: true },
  boardNewMemo: { key: 'n', mod: true },
}

export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

export function normalizeEventKey(key: string) {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toLowerCase()
  return key
}

export function chordFromEvent(event: KeyboardEvent): KeyChord | null {
  if (event.key === 'Control' || event.key === 'Meta' || event.key === 'Shift' || event.key === 'Alt') {
    return null
  }
  const key = normalizeEventKey(event.key)
  if (key === '?' && event.shiftKey) {
    return { key: '?' }
  }
  return {
    key,
    mod: event.metaKey || event.ctrlKey || undefined,
    shift: event.shiftKey || undefined,
    alt: event.altKey || undefined,
  }
}

export function chordsEqual(a: KeyChord, b: KeyChord) {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    Boolean(a.mod) === Boolean(b.mod) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  )
}

export function eventMatchesChord(event: KeyboardEvent, chord: KeyChord) {
  const next = chordFromEvent(event)
  return next ? chordsEqual(next, chord) : false
}

export function formatChord(chord: KeyChord) {
  const mac = isMacPlatform()
  const parts: string[] = []
  if (chord.mod) parts.push(mac ? '⌘' : 'Ctrl')
  if (chord.alt) parts.push(mac ? '⌥' : 'Alt')
  if (chord.shift && chord.key !== '?') parts.push(mac ? '⇧' : 'Shift')
  const label =
    chord.key === ' ' || chord.key === 'Space'
      ? 'Space'
      : chord.key.length === 1
        ? chord.key.toUpperCase()
        : chord.key
  parts.push(label)
  return parts.join(mac ? '' : '+')
}

export function parseStoredShortcuts(raw: string | null): Partial<Record<ShortcutId, KeyChord>> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ShortcutId, KeyChord>>
    if (!parsed || typeof parsed !== 'object') return {}
    const next: Partial<Record<ShortcutId, KeyChord>> = {}
    for (const item of SHORTCUT_META) {
      const chord = parsed[item.id]
      if (chord && typeof chord.key === 'string' && chord.key.length > 0) {
        next[item.id] = {
          key: chord.key,
          mod: chord.mod || undefined,
          shift: chord.shift || undefined,
          alt: chord.alt || undefined,
        }
      }
    }
    return next
  } catch {
    return {}
  }
}

export function mergeShortcuts(
  overrides: Partial<Record<ShortcutId, KeyChord>>
): Record<ShortcutId, KeyChord> {
  return { ...DEFAULT_SHORTCUTS, ...overrides }
}

export function findShortcutConflict(
  bindings: Record<ShortcutId, KeyChord>,
  id: ShortcutId,
  chord: KeyChord
): ShortcutId | null {
  for (const item of SHORTCUT_META) {
    if (item.id === id) continue
    if (chordsEqual(bindings[item.id], chord)) return item.id
  }
  return null
}
