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
import { TransferForm } from './transfer-form'

export function SettingsTransfer() {
  const { t } = useTranslation('settings')
  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.transfer')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('transfer.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('transfer.pageDescription')}
        </SettingsPageDescription>
      </header>
      <TransferForm />
    </div>
  )
}
