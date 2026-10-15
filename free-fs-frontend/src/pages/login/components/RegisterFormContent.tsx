/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { userApi } from '@/api'
import { useAuth } from '@/contexts/auth-context'
import type { UserRegisterParams } from '@/types/user'
import { User, Lock, Mail, Pen, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KineticTitle } from './KineticTitle'

interface Props {
  onSwitchForm: (form: 'login' | 'register' | 'forgotPassword') => void
  inviteToken?: string
}

export default function RegisterFormContent({ onSwitchForm, inviteToken }: Props) {
  const { t } = useTranslation('login')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  
  // 从 URL 获取邀请邮箱参数
  const inviteEmail = searchParams.get('email')
  
  const [formData, setFormData] = useState<UserRegisterParams>({
    username: '',
    password: '',
    confirmPassword: '',
    email: inviteEmail || '',
    nickname: '',
    inviteToken: inviteToken || undefined,
  })

  const hasInvitation = !!(inviteToken || formData.inviteToken)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('toast.passwordMismatch'))
      return
    }

    const submitData = formData.inviteToken
      ? { ...formData, inviteToken: formData.inviteToken }
      : formData

    setLoading(true)
    try {
      await userApi.register(submitData)
      toast.success(t('toast.registerSuccess'))

      if (formData.inviteToken) {
        // 有邀请 token：自动登录并进入邀请的工作空间
        try {
          await userApi.login({
            loginType: 'password',
            account: formData.username,
            password: formData.password,
            isRemember: true,
          })
          const userInfo = await userApi.getUserInfo()
          await login(userInfo, true)
          toast.success(t('toast.registerAndJoinSuccess'))
          navigate('/')
        } catch {
          onSwitchForm('login')
        }
      } else {
        // 无邀请：跳转登录页，登录后 needsWorkspaceSetup 会引导创建工作空间
        setTimeout(() => {
          onSwitchForm('login')
        }, 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col lfx-form gap-6'>
      <div className='flex flex-col gap-3'>
        <p className='tech-eyebrow'>注册账号</p>
        <KineticTitle
          text={t('createAccount')}
          className='text-[34px] leading-[1.1] font-semibold tracking-tight'
        />
        <p className='text-[13.5px] leading-relaxed text-muted-foreground'>
          {hasInvitation ? t('registerSubtitleInvite') : t('registerSubtitle')}
        </p>
      </div>

      {/* 邀请注册提示 */}
      {hasInvitation && (
        <div className='rounded-lg border border-hud/40 bg-accent-soft p-3 text-sm text-primary'>
          <div className='flex items-start gap-2'>
            <Info className='mt-0.5 h-4 w-4 shrink-0' />
            <div>
              <p className='font-medium'>{t('invitationRegisterNotice')}</p>
              <p className='mt-1 text-xs text-primary/80'>
                {t('autoJoinWorkspace')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <User className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='register-username'
            type='text'
            placeholder={t('placeholderUsername')}
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            className='h-11 pl-10'
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Lock className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='register-password'
            type='password'
            placeholder={t('placeholderPassword')}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className='h-11 pl-10'
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Lock className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='register-confirm-password'
            type='password'
            placeholder={t('placeholderConfirmPassword')}
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            className='h-11 pl-10'
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Mail className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='register-email'
            type='email'
            placeholder={t('placeholderEmail')}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className='h-11 pl-10'
            disabled={loading || hasInvitation}
            required
          />
        </div>
        {hasInvitation && (
          <p className='text-xs text-muted-foreground'>{t('emailFixedByInvite')}</p>
        )}
      </div>

      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Pen className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id='register-nickname'
            type='text'
            placeholder={t('placeholderNickname')}
            value={formData.nickname}
            onChange={(e) =>
              setFormData({ ...formData, nickname: e.target.value })
            }
            className='h-11 pl-10'
            disabled={loading}
            required
          />
        </div>
      </div>

      <Button
        type='submit'
        className='h-11 w-full lfx-btn-primary'
        disabled={loading}
      >
        {loading ? t('registering') : t('register')}
      </Button>

      <p className='text-sm text-muted-foreground'>
        {t('hasAccount')}{' '}
        <button
          type='button'
          className='underline underline-offset-2 hover:text-foreground'
          onClick={() => onSwitchForm('login')}
          disabled={loading}
        >
          {t('backToLogin')}
        </button>
      </p>
    </form>
  )
}
