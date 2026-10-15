/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type ImPresenceDotProps = {
  online: boolean
  children: ReactNode
  className?: string
}

export function ImPresenceDot({ online, children, className }: ImPresenceDotProps) {
  const { t } = useTranslation('messages')
  return (
    <span className={cn('im-presence', className)}>
      {children}
      <span
        className={cn('im-presence__dot', online ? 'is-on' : 'is-off')}
        title={online ? t('lan.online') : t('lan.offline')}
        aria-label={online ? t('lan.online') : t('lan.offline')}
      />
    </span>
  )
}
