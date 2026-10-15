/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import React, { Suspense } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Building2, Cloud, ShieldCheck, Zap } from 'lucide-react'
import { APP_NAME } from '@/config/brand'
import { Logo } from '@/components/logo'
import LoginFormContent from './components/LoginFormContent'
import RegisterFormContent from './components/RegisterFormContent'
import ForgotPasswordContent from './components/ForgotPasswordContent'
import { LoginLanguageSwitcher } from './components/LoginLanguageSwitcher'

function AuthSegmented({
  value,
  onChange,
}: {
  value: 'login' | 'register'
  onChange: (v: 'login' | 'register') => void
}) {
  const { t } = useTranslation('login')
  return (
    <SegmentedControl
      fill
      value={value}
      onChange={onChange}
      items={[
        { value: 'login', label: t('login') },
        { value: 'register', label: t('register') },
      ]}
    />
  )
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation('login')
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type') || 'login'

  const handleSwitchForm = (form: 'login' | 'register' | 'forgotPassword') => {
    const nextType = form === 'forgotPassword' ? 'forgot-password' : form
    setSearchParams({ type: nextType })
  }

  const inviteToken = searchParams.get('token') || undefined
  const isLogin = type !== 'register' && type !== 'forgot-password'

  const renderContent = () => {
    switch (type) {
      case 'register':
        return (
          <RegisterFormContent
            onSwitchForm={handleSwitchForm}
            inviteToken={inviteToken}
          />
        )
      case 'forgot-password':
        return <ForgotPasswordContent onSwitchForm={handleSwitchForm} />
      default:
        return <LoginFormContent onSwitchForm={handleSwitchForm} />
    }
  }

  return (
    <div className='a-login'>
      {/* ---------------------------------------------- 左：品牌视觉 */}
      <section className='a-login__stage'>
        <div className='a-brandline'>
          <span className='a-brandline__mark'>
            <Logo className='size-[18px]' />
          </span>
          <span className='a-brandline__name'>{APP_NAME}</span>
        </div>

        <div className='a-login__stagebody'>
          <span className='a-login__kicker'>
            <Building2 className='size-[13px]' strokeWidth={1.7} />
            {t('heroKicker')}
          </span>
          <h1 className='a-login__h'>
            {t('heroTitleLead')}
            <br />
            {t('heroTitleMid')}
            <em>{t('heroTitleEm')}</em>
            {t('heroTitleEnd')}
          </h1>
          <p className='a-login__p'>{t('heroBody')}</p>
          <div className='a-login__points'>
            <div className='a-login__point'>
              <i>
                <Zap className='size-[15px]' strokeWidth={1.6} />
              </i>
              {t('heroPointTransfer')}
            </div>
            <div className='a-login__point'>
              <i>
                <ShieldCheck className='size-[15px]' strokeWidth={1.6} />
              </i>
              {t('heroPointSecurity')}
            </div>
            <div className='a-login__point'>
              <i>
                <Cloud className='size-[15px]' strokeWidth={1.6} />
              </i>
              {t('heroPointStorage')}
            </div>
          </div>
        </div>

        <div className='a-login__foot'>
          <span>{t('footerCopyright')}</span>
          <span>{t('footerLicense')}</span>
          <span style={{ marginLeft: 'auto' }}>
            <LoginLanguageSwitcher />
          </span>
        </div>

        <div className='a-orb3d' aria-hidden />
      </section>

      {/* ---------------------------------------------- 右：表单卡 */}
      <section className='a-login__pane'>
        <div className='a-login__card a-glass' data-tilt='dense'>
          {isLogin && (
            <div className='a-login__cardhead'>
              <span
                className='a-brandline__mark a-brandline__mark--lg'
                style={{ margin: '0 auto' }}
              >
                <Logo className='size-[23px]' />
              </span>
              <h2>{t('welcomeBack')}</h2>
              <p>{t('loginAccount')}</p>
            </div>
          )}

          {(isLogin || type === 'register') && (
            <AuthSegmented
              value={type === 'register' ? 'register' : 'login'}
              onChange={handleSwitchForm}
            />
          )}

          <Suspense
            fallback={
              <div className='flex h-[240px] items-center justify-center'>
                <div className='size-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </div>
      </section>
    </div>
  )
}

export default LoginPage
