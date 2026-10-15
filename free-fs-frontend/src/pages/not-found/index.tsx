/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

export default function NotFoundPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  return (
    <div className='relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-16'>
      <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />

      <div className='a-brandline absolute top-7 left-7 z-10'>
        <span className='a-brandline__mark'>
          <Logo className='size-[18px]' />
        </span>
        <span className='a-brandline__name'>Alder</span>
      </div>

      <div className='a-glass tech-rise relative z-10 w-full max-w-xl rounded-[30px] px-8 py-12 text-center md:px-14 md:py-14'>
        <span className='mx-auto mb-7 flex size-14 items-center justify-center rounded-[18px] bg-accent-soft text-primary'>
          <Compass className='size-7' strokeWidth={1.7} />
        </span>

        <p className='tech-eyebrow'>页面不存在</p>

        {/* 柔和渐隐的 404：只用前景 token 的透明度，不另起色 */}
        <div className='mt-1 bg-gradient-to-b from-foreground/75 to-foreground/20 bg-clip-text font-mono text-[96px] leading-none font-semibold tracking-tight tabular-nums text-transparent md:text-[112px]'>
          404
        </div>

        <h1 className='mt-5 text-[30px] leading-tight font-semibold tracking-tight'>
          {t('notFound.title')}
        </h1>

        <p className='mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-text-secondary'>
          链接可能已经失效，或者你没有访问权限。
        </p>

        <div className='mt-8 flex justify-center'>
          <Button
            className='a-btn a-btn--primary h-11 px-8'
            onClick={() => navigate('/')}
          >
            {t('notFound.back')}
          </Button>
        </div>
      </div>
    </div>
  )
}
