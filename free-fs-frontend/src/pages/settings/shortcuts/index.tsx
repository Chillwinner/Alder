/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShortcutBindings } from '@/hooks/use-shortcut-bindings'
import {
  SHORTCUT_META,
  chordFromEvent,
  findShortcutConflict,
  formatChord,
  type ShortcutId,
} from '@/lib/shortcuts'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import { SettingsGroup, SettingsRow } from '../components/settings-row'

export function SettingsShortcuts() {
  const { t } = useTranslation('settings')
  const { bindings, setBinding, resetBinding, resetAll, setRecording } =
    useShortcutBindings()
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null)

  useEffect(() => {
    setRecording(Boolean(recordingId))
    return () => setRecording(false)
  }, [recordingId, setRecording])

  useEffect(() => {
    if (!recordingId) return

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecordingId(null)
        return
      }
      const chord = chordFromEvent(event)
      if (!chord) return
      const conflict = findShortcutConflict(bindings, recordingId, chord)
      if (conflict) {
        toast.error(
          t('shortcuts.conflict', {
            name: t(`shortcuts.items.${conflict}`),
          })
        )
        return
      }
      setBinding(recordingId, chord)
      setRecordingId(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [bindings, recordingId, setBinding, t])

  const renderGroup = (group: 'global' | 'files') => {
    const ids = SHORTCUT_META.filter((item) => item.group === group).map((item) => item.id)
    return (
      <SettingsGroup key={group} label={t(`shortcuts.groups.${group}`)}>
        {ids.map((id) => (
          <SettingsRow
            key={id}
            icon={Keyboard}
            tone='neutral'
            label={t(`shortcuts.items.${id}`)}
          >
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='min-w-[92px] font-mono text-[12px]'
                onClick={() => setRecordingId(id)}
              >
                {recordingId === id
                  ? t('shortcuts.recording')
                  : formatChord(bindings[id])}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={() => resetBinding(id)}
              >
                {t('shortcuts.reset')}
              </Button>
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>
    )
  }

  return (
    <div className='flex flex-1 flex-col'>
      <header className='mb-6 flex flex-none flex-col gap-1.5'>
        <SettingsPageEyebrow>{t('nav.shortcuts')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('shortcuts.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>{t('shortcuts.pageDescription')}</SettingsPageDescription>
      </header>
      <div className='flex flex-col gap-6'>
        {renderGroup('global')}
        {renderGroup('files')}
        <div>
          <Button type='button' variant='outline' onClick={resetAll}>
            {t('shortcuts.resetAll')}
          </Button>
        </div>
      </div>
    </div>
  )
}
