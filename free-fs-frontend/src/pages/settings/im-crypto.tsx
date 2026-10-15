/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { downloadJsonFile } from '@/lib/im-crypto'
import type { ImPrivateKeyBackup } from '@/lib/im-crypto'
import {
  loadPrivateKeyBackup,
  savePrivateKeyBackup,
} from '@/lib/im-crypto-storage'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from './components/settings-page-header'
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from './components/settings-row'
import { AlertCircle, Download, KeyRound, Upload } from 'lucide-react'
import { activateImCryptoFromBackup } from '@/lib/im-crypto-session'

export function SettingsImCrypto() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const importRef = useRef<HTMLInputElement>(null)

  const handleDownload = async () => {
    if (!user?.id) return
    const backup = await loadPrivateKeyBackup(user.id)
    if (!backup) {
      toast.error(t('imCrypto.noLocalKey'))
      return
    }
    downloadJsonFile(`alder-im-key-${user.id}.json`, backup)
    toast.success(t('imCrypto.downloadStarted'))
  }

  const handleImport = async (file: File) => {
    if (!user?.id) return
    try {
      const backup = JSON.parse(await file.text()) as ImPrivateKeyBackup
      if (backup.userId !== user.id) {
        toast.error(t('imCrypto.importUserMismatch'))
        return
      }
      await savePrivateKeyBackup(user.id, backup)
      await activateImCryptoFromBackup(backup, user.id)
      toast.success(t('imCrypto.importOk'))
    } catch {
      toast.error(t('imCrypto.importFailed'))
    }
  }

  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.imCrypto')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('imCrypto.title')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('imCrypto.description')}
        </SettingsPageDescription>
      </header>
      <input
        ref={importRef}
        type='file'
        accept='application/json,.json'
        className='hidden'
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleImport(file)
        }}
      />
      <SettingsGroup
        label={t('imCrypto.title')}
        description={t('imCrypto.description')}
        action={<span className='a-tag a-tag--accent'>{t('nav.imCrypto')}</span>}
      >
        <SettingsRow
          icon={AlertCircle}
          tone='warning'
          align='start'
          label={t('imCrypto.warning')}
          description={t('imCrypto.warningDesc')}
        />

        <SettingsBlock
          icon={KeyRound}
          tone='purple'
          label={t('imCrypto.download')}
        >
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              className='a-btn a-btn--secondary a-btn--sm'
              onClick={() => void handleDownload()}
            >
              <Download className='size-3.5' strokeWidth={2} aria-hidden />
              {t('imCrypto.download')}
            </Button>
            <Button
              type='button'
              className='a-btn a-btn--ghost a-btn--sm'
              onClick={() => importRef.current?.click()}
            >
              <Upload className='size-3.5' strokeWidth={2} aria-hidden />
              {t('imCrypto.import')}
            </Button>
          </div>
        </SettingsBlock>
      </SettingsGroup>
    </div>
  )
}
