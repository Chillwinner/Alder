/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { userApi } from '@/api'
import { useAuth } from '@/contexts/auth-context'
import type { LoginParams, LoginType } from '@/types/user'
import { Eye, EyeOff, KeyRound, Lock, Mail, User } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getSafeRedirectPath } from '@/utils/auth-redirect'

interface Props {
  onSwitchForm: (form: 'login' | 'register' | 'forgotPassword') => void
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginFormContent({ onSwitchForm }: Props) {
  const { t } = useTranslation('login')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loginType, setLoginType] = useState<LoginType>('password')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [isRemember, setIsRemember] = useState(true)
  const [codeSending, setCodeSending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 邀请流程带过来的邮箱
  const suggestedEmail = searchParams.get('email')

  useEffect(() => {
    if (suggestedEmail) setAccount(suggestedEmail)
  }, [suggestedEmail])

  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [countdown])

  const handleSendCode = async () => {
    const mail = account.trim()
    if (!emailRegex.test(mail)) {
      toast.error(t('toast.enterValidEmail'))
      return
    }
    setCodeSending(true)
    try {
      await userApi.sendLoginEmailCode(mail)
      toast.success(t('toast.codeSent'))
      setCountdown(60)
    } catch {
      // 由拦截器提示
    } finally {
      setCodeSending(false)
    }
  }

  const performLogin = async (payload: LoginParams) => {
    setLoading(true)
    try {
      await userApi.login(payload)
      const userInfo = await userApi.getUserInfo()
      await login(userInfo, isRemember)
      toast.success(t('toast.loginSuccess'))
      const next = getSafeRedirectPath(searchParams) ?? '/'
      navigate(next, { replace: true })
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const acc = account.trim()
    if (!acc) {
      toast.error(
        loginType === 'email_code'
          ? t('toast.enterEmail')
          : t('toast.enterUsernameOrEmail')
      )
      return
    }

    if (loginType === 'password') {
      if (!password) {
        toast.error(t('toast.enterPassword'))
        return
      }
    } else {
      if (!emailRegex.test(acc)) {
        toast.error(t('toast.useEmailLogin'))
        return
      }
      if (!emailCode.trim()) {
        toast.error(t('toast.enterVerificationCode'))
        return
      }
    }

    await performLogin({
      loginType,
      account: acc,
      password: loginType === 'password' ? password : emailCode.trim(),
      isRemember,
    })
  }

  const quickLogin = (acc: string, pwd: string) => {
    void performLogin({
      loginType: 'password',
      account: acc,
      password: pwd,
      isRemember,
    })
  }

  const handleSocialLogin = (platform: string) => {
    toast.info(t('toast.socialLoginPending', { platform }))
  }

  const toggleLoginType = () => {
    setLoginType((v) => (v === 'password' ? 'email_code' : 'password'))
    setPassword('')
    setEmailCode('')
  }

  return (
    <form onSubmit={handleSubmit} className='a-login__form' autoComplete='on'>
      {suggestedEmail && (
        <div className='a-field'>
          <div
            className='rounded-[13px] px-3.5 py-3'
            style={{ background: 'var(--accent-soft)' }}
          >
            <p
              className='text-[13px] font-medium'
              style={{ color: 'var(--primary)' }}
            >
              {t('inviteEmailNotice')}
            </p>
            <p
              className='mt-1 font-mono text-[11.5px]'
              style={{ color: 'var(--primary)' }}
            >
              {t('useEmail')}: <strong>{suggestedEmail}</strong>
            </p>
          </div>
        </div>
      )}

      {/* 账号 */}
      <div className='a-field'>
        <label htmlFor='account'>
          {loginType === 'password' ? '账号 / 邮箱' : '邮箱'}
        </label>
        <div className='a-input'>
          {loginType === 'password' ? (
            <User className='size-4' strokeWidth={1.6} />
          ) : (
            <Mail className='size-4' strokeWidth={1.6} />
          )}
          <input
            id='account'
            type={loginType === 'email_code' ? 'email' : 'text'}
            inputMode={loginType === 'email_code' ? 'email' : undefined}
            placeholder={
              loginType === 'password'
                ? t('placeholderUsernameOrEmail')
                : t('placeholderEmail')
            }
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete={loginType === 'password' ? 'username' : 'email'}
            required
          />
        </div>
      </div>

      {/* 密码 / 验证码 */}
      {loginType === 'password' ? (
        <div className='a-field'>
          <label htmlFor='password'>密码</label>
          <div className='a-input'>
            <Lock className='size-4' strokeWidth={1.6} />
            <input
              id='password'
              type={showPassword ? 'text' : 'password'}
              placeholder={t('placeholderPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='current-password'
              required
            />
            <button
              type='button'
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              className='shrink-0 transition-colors'
              style={{ color: 'var(--text-muted)' }}
            >
              {showPassword ? (
                <EyeOff className='size-4' strokeWidth={1.55} />
              ) : (
                <Eye className='size-4' strokeWidth={1.55} />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className='a-field'>
          <label htmlFor='email-code'>邮箱验证码</label>
          <div className='flex gap-2'>
            <div className='a-input' style={{ flex: 1, minWidth: 0 }}>
              <KeyRound className='size-4' strokeWidth={1.6} />
              <input
                id='email-code'
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                placeholder={t('placeholderEmailCode')}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                required
              />
            </div>
            <button
              type='button'
              className='a-btn a-btn--ghost'
              style={{ height: 50 }}
              disabled={codeSending || countdown > 0 || !account.trim()}
              onClick={handleSendCode}
            >
              {countdown > 0
                ? t('codeCountdown', { countdown })
                : t('getVerificationCode')}
            </button>
          </div>
        </div>
      )}

      {/* 记住我 / 切换登录方式 */}
      <div className='a-login__row'>
        <label
          htmlFor='remember'
          className='flex cursor-pointer items-center gap-2 text-[13.5px] select-none'
          style={{ color: 'var(--text-secondary)' }}
        >
          <input
            id='remember'
            type='checkbox'
            checked={isRemember}
            onChange={(e) => setIsRemember(e.target.checked)}
            className='size-[17px] cursor-pointer rounded-[5px]'
            style={{ accentColor: 'var(--primary)' }}
          />
          {t('rememberMe')}
        </label>
        <button type='button' onClick={toggleLoginType} className='a-login__link'>
          {loginType === 'password' ? t('emailCodeLogin') : t('passwordLogin')}
        </button>
      </div>

      <button
        type='submit'
        className='a-btn a-btn--primary a-btn--lg a-btn--block'
        disabled={loading}
      >
        {loading ? t('loggingIn') : t('login')}
      </button>

      {/* 开发快捷登录：真后端里 admin/admin 与 Test/123 是可用的开发号 */}
      <div className='flex gap-2'>
        <button
          type='button'
          className='a-btn a-btn--ghost a-btn--sm'
          style={{ flex: 1, height: 38 }}
          disabled={loading}
          onClick={() => quickLogin('admin', 'admin')}
        >
          测试登录 admin
        </button>
        <button
          type='button'
          className='a-btn a-btn--ghost a-btn--sm'
          style={{ flex: 1, height: 38 }}
          disabled={loading}
          onClick={() => quickLogin('Test', '123')}
        >
          测试登录 Test
        </button>
      </div>

      <div className='a-login__row'>
        <button
          type='button'
          onClick={() => onSwitchForm('forgotPassword')}
          className='text-[13.5px] underline-offset-2 hover:underline'
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('forgotPassword')}
        </button>
      </div>

      <div className='a-login__divider'>{t('orContinueWith')}</div>

      <div className='a-login__oauth'>
        <button
          type='button'
          className='a-oauth'
          onClick={() => handleSocialLogin(t('socialWechat'))}
        >
          <img
            src='/svg/wechat.svg'
            alt=''
            className='size-[30px] object-contain'
            aria-hidden
          />
          <span className='sr-only'>{t('loginWithWechat')}</span>
        </button>
        <button
          type='button'
          className='a-oauth'
          onClick={() => handleSocialLogin(t('socialGitee'))}
        >
          <img
            src='/svg/gitee.svg'
            alt=''
            className='size-[30px] object-contain'
            aria-hidden
          />
          <span className='sr-only'>{t('loginWithGitee')}</span>
        </button>
        <button
          type='button'
          className='a-oauth'
          onClick={() => handleSocialLogin(t('socialGithub'))}
        >
          <img
            src='/svg/github.svg'
            alt=''
            className='size-[30px] object-contain'
            aria-hidden
          />
          <span className='sr-only'>{t('loginWithGithub')}</span>
        </button>
      </div>

      <p className='a-login__legal'>
        {t('noAccount')}{' '}
        <button type='button' onClick={() => onSwitchForm('register')}>
          <span className='underline underline-offset-2'>
            {t('registerNow')}
          </span>
        </button>
      </p>
    </form>
  )
}
