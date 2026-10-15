/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/auth-context'
import { Copy, Check, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { copyTextToClipboard } from '@/utils/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import { SettingsGroup, SettingsRow } from '../components/settings-row'
import { ProfileForm } from './profile-form'
import { AccountSecuritySection } from './account-security-section'

export function SettingsProfile() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const [copiedUserId, setCopiedUserId] = useState(false)

  const handleCopyUserId = async () => {
    if (!user?.id) return
    try {
      await copyTextToClipboard(user.id.toString())
      setCopiedUserId(true)
      setTimeout(() => setCopiedUserId(false), 2000)
      toast.success(t('profile.copied'))
    } catch (error) {
      toast.error(t('profile.copyFailed'))
    }
  }

  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.profile')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('profile.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('profile.pageDescription')}
        </SettingsPageDescription>
      </header>

      <div className='flex flex-col'>
        <SettingsGroup
          label={t('profile.sectionAccount')}
          description={t('profile.pageDescription')}
          action={<span className='a-tag a-tag--accent'>{t('profile.sectionAccount')}</span>}
        >
          <ProfileForm />
        </SettingsGroup>

        <SettingsGroup
          label={t('profile.sectionSecurity')}
          action={<span className='a-tag'>{t('profile.sectionSecurity')}</span>}
        >
          <AccountSecuritySection />
        </SettingsGroup>

        <SettingsGroup label={t('profile.sectionUserId')}>
          <SettingsRow
            icon={Fingerprint}
            tone='neutral'
            label={t('profile.userIdLabel')}
            value={user?.id || '-'}
          >
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-8 shrink-0 rounded-full'
              onClick={handleCopyUserId}
            >
              {copiedUserId ? (
                <Check className='size-4 text-success' />
              ) : (
                <Copy />
              )}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </div>
    </div>
  )
}
