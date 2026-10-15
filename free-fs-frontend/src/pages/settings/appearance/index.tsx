/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  const { t } = useTranslation('settings')
  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.preference')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('appearance.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('appearance.pageDescription')}
        </SettingsPageDescription>
      </header>
      <div className='flex flex-1 flex-col'>
        <AppearanceForm />
      </div>
    </div>
  )
}
