/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { primeNotificationAudio } from '@/lib/notification-chime'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeaderNotificationPopover } from '@/components/layout/header-notification-popover'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTheme } from '@/components/theme-provider'
import { MessagesHeaderButton } from '@/components/messages/messages-header-button'
import { Search } from '@/components/search'
import { useSearch } from '@/context/search-provider'
import { AppBreadcrumb } from './breadcrumb'
import { HeaderUser } from './header-user'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const { t } = useTranslation('layout')
  const { theme } = useTheme()
  const { setOpen } = useSearch()

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const prime = () => {
      primeNotificationAudio()
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
    }
    window.addEventListener('pointerdown', prime, { passive: true })
    window.addEventListener('keydown', prime, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
    }
  }, [])

  return (
    <header
      className={cn(
        // iOS 26 悬浮胶囊顶栏：不再贴边、不再有分割线，改用玻璃材质浮在内容之上
        'app-header a-glass z-50 h-[58px] w-full rounded-full',
        fixed && 'header-fixed peer/header sticky top-[18px]',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full w-full items-center px-4'
        )}
      >
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <SidebarTrigger className='-ms-1 size-8 text-text-secondary hover:bg-surface-secondary hover:text-foreground' />
          <div className='min-w-0'>
            <AppBreadcrumb />
          </div>
          {children}
        </div>

        <div className='pointer-events-none absolute inset-x-0 hidden justify-center md:flex'>
          <div className='pointer-events-auto'>
            <Search />
          </div>
        </div>

        <div className='flex flex-1 items-center justify-end gap-1'>
          <TooltipProvider>
            <HeaderNotificationPopover />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  className='inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-foreground md:hidden'
                  onClick={() => setOpen(true)}
                  aria-label={t('header.search')}
                >
                  <SearchIcon className='size-[18px]' strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('header.search')}</p>
              </TooltipContent>
            </Tooltip>
            <MessagesHeaderButton />
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <AnimatedThemeToggler className='inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-foreground' />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isDark ? t('header.lightMode') : t('header.darkMode')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <HeaderUser />
        </div>
      </div>
    </header>
  )
}
