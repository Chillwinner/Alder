/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSearch } from '@/context/search-provider'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { useShortcutBindings } from '@/hooks/use-shortcut-bindings'
import { formatChord, SHORTCUT_META, type ShortcutId } from '@/lib/shortcuts'
import { useSidebar } from '@/components/ui/sidebar'
import { useImStore } from '@/store/im'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.matches('input, textarea, select') ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

export function ShortcutsHost() {
  const { t } = useTranslation('common')
  const { t: ts } = useTranslation('settings')
  const { bindings, matches, recording } = useShortcutBindings()
  const { open: paletteOpen, setOpen: setPaletteOpen } = useSearch()
  const { open: settingsOpen, setOpen: setSettingsOpen, openSettings } = useSettingsModal()
  const { toggleSidebar } = useSidebar()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (recording) return
      if (event.defaultPrevented) return

      const typing = isTypingTarget(event.target)
      if (matches(event, 'commandPalette')) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (typing || paletteOpen) return

      if (matches(event, 'toggleSidebar')) {
        event.preventDefault()
        toggleSidebar()
        return
      }
      if (matches(event, 'openMessages')) {
        event.preventDefault()
        useImStore.getState().openDialog()
        return
      }
      if (matches(event, 'openSettings')) {
        event.preventDefault()
        if (settingsOpen) setSettingsOpen(false)
        else openSettings()
        return
      }
      if (matches(event, 'help')) {
        event.preventDefault()
        setHelpOpen((open) => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    matches,
    openSettings,
    paletteOpen,
    recording,
    setPaletteOpen,
    setSettingsOpen,
    settingsOpen,
    toggleSidebar,
  ])

  const groups: { group: 'global' | 'files' | 'board'; ids: ShortcutId[] }[] = [
    {
      group: 'global',
      ids: SHORTCUT_META.filter((item) => item.group === 'global').map((item) => item.id),
    },
    {
      group: 'files',
      ids: SHORTCUT_META.filter((item) => item.group === 'files').map((item) => item.id),
    },
    {
      group: 'board',
      ids: SHORTCUT_META.filter((item) => item.group === 'board').map((item) => item.id),
    },
  ]

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className='glass-card max-w-md gap-0 overflow-hidden rounded-[24px] p-0'>
        <div className='flex items-center gap-2.5 border-b border-divider px-5 py-4'>
          <Keyboard className='size-4 text-muted-foreground' strokeWidth={1.8} />
          <DialogTitle className='text-[15px] font-semibold'>
            {t('shortcuts.cheatsheetTitle')}
          </DialogTitle>
        </div>
        <div className='flex flex-col gap-5 px-5 py-4'>
          {groups.map((group) => (
            <section key={group.group} className='flex flex-col gap-2'>
              <h3 className='text-[12px] font-medium uppercase tracking-wide text-muted-foreground'>
                {ts(`shortcuts.groups.${group.group}`)}
              </h3>
              <ul className='flex flex-col gap-1.5'>
                {group.ids.map((id) => (
                  <li key={id} className='flex items-center justify-between gap-3 text-[13px]'>
                    <span>{ts(`shortcuts.items.${id}`)}</span>
                    <kbd className='rounded border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground'>
                      {formatChord(bindings[id])}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
