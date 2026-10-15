/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react'
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

interface NavUserProps {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const { t } = useTranslation('layout')
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const { logout } = useAuth()
  const { isMobile, state } = useSidebar()

  const avatarFallback = getAvatarFallback(user.name)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='h-auto rounded-[10px] border border-border bg-surface/70 px-2 py-1.5 hover:bg-surface data-[active=true]:before:hidden group-data-[collapsible=icon]:size-10!'
            >
              <Avatar className='size-7 rounded-md'>
                <AvatarImage src={resolveMediaUrl(user.avatar)} alt={user.name} />
                <AvatarFallback className='rounded-md bg-surface-secondary text-[10px] font-medium'>
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              {state === 'expanded' && (
                <>
                  <div className='grid min-w-0 flex-1 text-start leading-tight'>
                    <span className='truncate text-[13px] font-medium'>
                      {user.name}
                    </span>
                    {user.email ? (
                      <span className='truncate text-[12px] text-text-muted'>
                        {user.email}
                      </span>
                    ) : null}
                  </div>
                  <ChevronsUpDown className='ms-auto size-3.5 text-text-muted' />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-72 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <div className='flex items-start gap-3 px-3 py-3'>
                <Avatar className='size-9 shrink-0 rounded-md'>
                  <AvatarImage src={resolveMediaUrl(user.avatar)} alt={user.name} />
                  <AvatarFallback className='rounded-md bg-muted text-xs font-medium'>
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-[14px] font-semibold leading-tight'>
                    {user.name}
                  </p>
                  {user.email ? (
                    <p className='mt-0.5 truncate text-[12px] text-muted-foreground'>
                      {user.email}
                    </p>
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
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
