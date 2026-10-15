/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NoPermission() {
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className='flex h-[60vh] flex-col items-center justify-center px-4'>
      <div className='glass-card hud-corners flex w-full max-w-md flex-col items-center gap-4 p-8 text-center'>
        <div className='flex size-14 items-center justify-center rounded-[10px] border border-hud/40 bg-accent-soft'>
          <ShieldX className='size-7 text-hud' strokeWidth={1.75} />
        </div>
        <p className='font-mono text-[11px] font-medium tracking-[0.2em] text-hud uppercase'>
          403 · ACCESS DENIED
        </p>
        <h2 className='text-[17px] font-semibold tracking-tight'>
          {t('noAccess.title')}
        </h2>
        <p className='text-[13.5px] leading-relaxed text-muted-foreground'>
          {t('noAccess.description')}
        </p>
        <Button
          className='mt-1'
          onClick={() => navigate(slug ? `/w/${slug}/` : '/')}
        >
          {t('noAccess.backHome')}
        </Button>
      </div>
    </div>
  )
}
