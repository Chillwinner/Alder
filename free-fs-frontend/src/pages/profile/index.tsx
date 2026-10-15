/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { UserRound } from 'lucide-react'

export default function ProfilePage() {
  const { t } = useTranslation('common')
  return (
    <div className='a-page mx-auto w-full max-w-[1600px] p-6'>
      <header className='a-phead'>
        <div>
          <span className='a-eyebrow'>个人资料</span>
          <h1>{t('profile.title')}</h1>
        </div>
      </header>

      <section className='glass-card flex min-w-0 items-start gap-4 rounded-[24px] p-5'>
        <span
          className='grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-primary'
          aria-hidden
        >
          <UserRound className='size-4' strokeWidth={1.9} />
        </span>
        <p className='max-w-prose text-[13.5px] leading-relaxed text-text-secondary'>
          {t('profile.description')}
        </p>
      </section>
    </div>
  )
}
