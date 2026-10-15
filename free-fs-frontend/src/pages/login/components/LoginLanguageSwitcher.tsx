/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { getAppLang } from '@/i18n'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体' },
  { value: 'zh-HK', label: '繁體' },
] as const

export function LoginLanguageSwitcher() {
  const { i18n } = useTranslation()
  const lang = getAppLang()

  return (
    <div className='flex items-center gap-2 font-mono text-[11px] tracking-wider text-muted-foreground'>
      {OPTIONS.map((option, index) => (
        <span key={option.value} className='flex items-center gap-2'>
          {index > 0 ? (
            <span aria-hidden className='text-muted-foreground/40'>
              |
            </span>
          ) : null}
          <button
            type='button'
            onClick={() => void i18n.changeLanguage(option.value)}
            className={cn(
              'transition-colors hover:text-foreground',
              lang === option.value && 'font-medium text-foreground'
            )}
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  )
}
