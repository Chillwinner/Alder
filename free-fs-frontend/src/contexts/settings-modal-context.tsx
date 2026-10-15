/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'transfer'
  | 'workspace'
  | 'storage'
  | 'members'
  | 'roles'
  | 'logs'
  | 'imCrypto'
  | 'ai'
  | 'shortcuts'
  | 'site'

type SettingsModalValue = {
  open: boolean
  setOpen: (open: boolean) => void
  tab: SettingsTab
  setTab: (tab: SettingsTab) => void
  openSettings: (tab?: SettingsTab, options?: { membersSubTab?: 'received' }) => void
  membersSubTab: 'members' | 'invitations' | 'received' | null
  clearMembersSubTab: () => void
}

const SettingsModalContext = createContext<SettingsModalValue | null>(null)

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [membersSubTab, setMembersSubTab] = useState<
    'members' | 'invitations' | 'received' | null
  >(null)

  const clearMembersSubTab = useCallback(() => setMembersSubTab(null), [])

  const openSettings = useCallback(
    (next?: SettingsTab, options?: { membersSubTab?: 'received' }) => {
      if (next) setTab(next)
      if (options?.membersSubTab) {
        setMembersSubTab(options.membersSubTab)
      }
      setOpen(true)
    },
    []
  )

  const value = useMemo(
    () => ({
      open,
      setOpen,
      tab,
      setTab,
      openSettings,
      membersSubTab,
      clearMembersSubTab,
    }),
    [open, tab, openSettings, membersSubTab, clearMembersSubTab]
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  )
}

export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext)
  if (!ctx) {
    throw new Error('useSettingsModal must be used within SettingsModalProvider')
  }
  return ctx
}
