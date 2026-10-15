/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/auth-context'
import { ChevronRight, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SettingsRow } from '../components/settings-row'
import { EmailChangeForm, PasswordChangeForm } from './account-forms'

export function AccountSecuritySection() {
  const { t } = useTranslation('settings')
  const { user } = useAuth()
  const [emailOpen, setEmailOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <>
      <SettingsRow
        icon={Mail}
        tone='blue'
        label={t('account.email')}
        description={
          <span className='font-mono tabular-nums'>
            {user?.email || t('account.notSet')}
          </span>
        }
      >
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='a-btn a-btn--secondary a-btn--sm'
          onClick={() => setEmailOpen(true)}
        >
          {t('account.manageEmail')}
          <ChevronRight className='size-3.5' strokeWidth={2.2} aria-hidden />
        </Button>
      </SettingsRow>

      <SettingsRow
        icon={ShieldCheck}
        tone='success'
        label={t('account.password')}
        description={t('account.passwordHint')}
      >
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='a-btn a-btn--secondary a-btn--sm'
          onClick={() => setPasswordOpen(true)}
        >
          {user?.isSetPassword === false
            ? t('account.setPassword')
            : t('account.changePassword')}
          <ChevronRight className='size-3.5' strokeWidth={2.2} aria-hidden />
        </Button>
      </SettingsRow>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('account.dialogEmailTitle')}</DialogTitle>
            <DialogDescription>
              {t('account.dialogEmailDesc')}
            </DialogDescription>
          </DialogHeader>
          <EmailChangeForm
            onSuccess={() => setEmailOpen(false)}
            onCancel={() => setEmailOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {user?.isSetPassword === false
                ? t('account.dialogSetPwdTitle')
                : t('account.dialogChangePwdTitle')}
            </DialogTitle>
            <DialogDescription>
              {user?.isSetPassword === false
                ? t('account.dialogSetPwdDesc')
                : t('account.dialogChangePwdDesc')}
            </DialogDescription>
          </DialogHeader>
          <PasswordChangeForm
            key={user?.isSetPassword === false ? 'set' : 'change'}
            mode={user?.isSetPassword === false ? 'set' : 'change'}
            onSuccess={() => setPasswordOpen(false)}
            onCancel={() => setPasswordOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
