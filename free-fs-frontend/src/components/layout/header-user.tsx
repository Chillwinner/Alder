/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { getAvatarFallback } from '@/utils/avatar'
import { resolveMediaUrl } from '@/utils/media-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function HeaderUser() {
  const { t } = useTranslation('layout')
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const { user, logout } = useAuth()

  const name = user?.nickname || user?.username || t('sidebar.userPlaceholder')
  const email = user?.email ?? ''
  const avatar = user?.avatar ?? ''
  const avatarFallback = getAvatarFallback(name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='flex size-8 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring'
          aria-label={name}
        >
          <Avatar className='size-6 rounded-md'>
            <AvatarImage src={resolveMediaUrl(avatar)} alt={name} />
            <AvatarFallback className='rounded-md bg-muted text-[10px] font-medium'>
              {avatarFallback}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-72 rounded-lg' align='end' sideOffset={6}>
        <DropdownMenuGroup>
          <div className='flex items-start gap-3 px-3 py-3'>
            <Avatar className='size-9 shrink-0 rounded-md'>
              <AvatarImage src={resolveMediaUrl(avatar)} alt={name} />
              <AvatarFallback className='rounded-md bg-muted text-xs font-medium'>
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[14px] font-semibold leading-tight'>{name}</p>
              {email ? (
                <p className='mt-0.5 truncate text-[12px] text-muted-foreground'>{email}</p>
              ) : null}
            </div>
          </div>
          <div className='flex gap-2 px-3 pb-3'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                openSettings('profile')
              }}
              className='flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted/70 px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted'
            >
              <Settings className='size-3.5' strokeWidth={1.75} />
              {t('navUser.accountSettings')}
            </button>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='cursor-pointer gap-2.5'
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <span className='flex size-6 items-center justify-center rounded-md bg-muted'>
              <LogOut className='size-3.5' strokeWidth={1.75} />
            </span>
            <span>{t('navUser.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
