/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { userApi } from '@/api'
import { ForgotPasswordParams } from '@/types/user'
import { Mail, Lock, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KineticTitle } from './KineticTitle'

interface Props {
  onSwitchForm: (form: 'login' | 'register' | 'forgotPassword') => void
}

export default function ForgotPasswordContent({ onSwitchForm }: Props) {
  const { t } = useTranslation('login')
  const [loading, setLoading] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [formData, setFormData] = useState<ForgotPasswordParams>({
    mail: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendCode = async () => {
    if (!formData.mail) {
      toast.warning(t('toast.enterEmailWarning'))
      return
    }

    setCodeLoading(true)
    try {
      await userApi.sendForgetPasswordCode(formData.mail)
      toast.success(t('toast.codeSentToMailbox'))
      setCountdown(60)
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setCodeLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 只验证密码一致性
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('toast.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await userApi.updateForgetPassword(formData)
      toast.success(t('toast.resetSuccess'))
      setFormData({
        mail: '',
        code: '',
        newPassword: '',
        confirmPassword: '',
      })
      onSwitchForm('login')
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col lfx-form gap-6'>
      <div className='flex flex-col gap-3'>
        <p className='tech-eyebrow'>找回密码</p>
        <KineticTitle
          text={t('recoverPassword')}
          className='text-[34px] leading-[1.1] font-semibold tracking-tight'
        />
        <p className='text-[13.5px] leading-relaxed text-muted-foreground'>
          {t('recoverSubtitle')}
        </p>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Mail className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='forgot-mail'
            type='email'
            placeholder={t('placeholderEmail')}
            value={formData.mail}
            onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
            className='h-11 pl-10'
            required
          />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Shield className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='forgot-code'
            type='text'
            placeholder={t('placeholderVerificationCode')}
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            maxLength={6}
            className='h-11 pr-28 pl-10'
            required
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='absolute top-1/2 right-1 h-8 -translate-y-1/2 text-xs'
            onClick={handleSendCode}
            disabled={countdown > 0 || codeLoading}
          >
            {countdown > 0
              ? t('retryAfter', { countdown })
              : t('sendVerificationCode')}
          </Button>
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Lock className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='forgot-new-password'
            type='password'
            placeholder={t('placeholderNewPassword')}
            value={formData.newPassword}
            onChange={(e) =>
              setFormData({ ...formData, newPassword: e.target.value })
            }
            className='h-11 pl-10'
            required
          />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Lock className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='forgot-confirm-password'
            type='password'
            placeholder={t('placeholderConfirmNewPassword')}
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            className='h-11 pl-10'
            required
          />
        </div>
      </div>

      <Button
        type='submit'
        className='h-11 w-full lfx-btn-primary'
        disabled={loading}
      >
        {loading ? t('resetting') : t('resetPassword')}
      </Button>

      <p className='text-sm text-muted-foreground'>
        {t('rememberedPassword')}{' '}
        <button
          type='button'
          className='underline underline-offset-2 hover:text-foreground'
          onClick={() => onSwitchForm('login')}
        >
          {t('backToLogin')}
        </button>
      </p>
    </form>
  )
}
