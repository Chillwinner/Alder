/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Settings, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspaceStore } from '@/store/workspace'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { Logo } from '@/components/logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('layout')
  const navigate = useNavigate()
  const { isMobile, state } = useSidebar()
  const { activateWorkspace } = useAuth()
  const { openSettings } = useSettingsModal()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const [switching, setSwitching] = useState(false)

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  const handleSwitch = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === currentWorkspaceId || switching) return
      const target = workspaces.find((w) => w.id === workspaceId)
      if (!target) return

      setSwitching(true)
      try {
        await activateWorkspace(workspaceId)
        navigate(`/w/${target.slug}/`)
        toast.success(t('workspaceSwitcher.switchToast', { name: target.name }))
      } catch (err: any) {
        if (!err?.handled) toast.error(t('workspaceSwitcher.switchFailed'))
      } finally {
        setSwitching(false)
      }
    },
    [currentWorkspaceId, switching, workspaces, navigate, activateWorkspace, t]
  )

  const displayName =
    currentWorkspace?.name ?? t('workspaceSwitcher.selectWorkspace')
  const subtitle = currentWorkspace
    ? t('workspaceSwitcher.memberCount', {
        count: currentWorkspace.memberCount,
      })
    : t('workspaceSwitcher.subtitle')

  const menuContent = (
    <DropdownMenuContent
      className='w-72 rounded-lg'
      side={isMobile ? 'bottom' : 'right'}
      align='start'
      sideOffset={6}
    >
<DropdownMenuGroup>
            {currentWorkspace && (
              <>
                <div className='flex items-start gap-3 px-3 py-3'>
                  <Logo className='size-9 shrink-0 text-primary' />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-[14px] font-semibold leading-tight'>
                      {currentWorkspace.name}
                    </p>
                    <p className='mt-0.5 text-[12px] text-muted-foreground'>
                      {t('workspaceSwitcher.memberCount', {
                        count: currentWorkspace.memberCount,
                      })}
                    </p>
                  </div>
                </div>
                <div className='flex gap-2 px-3 pb-3'>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      openSettings('workspace')
                    }}
                    className='flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted/70 px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted'
                  >
                    <Settings className='size-3.5' strokeWidth={1.75} />
                    {t('workspaceSwitcher.settings')}
                  </button>
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation()
                      openSettings('members')
                    }}
                    className='flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted/70 px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted'
                  >
                    <UserPlus className='size-3.5' strokeWidth={1.75} />
                    {t('workspaceSwitcher.inviteMembers')}
                  </button>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className='text-[11px] font-medium text-muted-foreground'>
              {t('workspaceSwitcher.sectionTitle')}
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className='cursor-pointer gap-2.5'
                disabled={switching}
              >
                <Logo className='size-6 shrink-0 text-primary' />
                <div className='flex min-w-0 flex-1 flex-col'>
                  <span className='truncate text-[13px]'>{ws.name}</span>
                  <span className='truncate text-[12px] text-muted-foreground'>
                    {t('workspaceSwitcher.memberCount', { count: ws.memberCount })}
                  </span>
                </div>
                {ws.id === currentWorkspaceId && (
                  <span className='ml-auto text-[11px] text-muted-foreground'>
                    {t('workspaceSwitcher.current')}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='cursor-pointer gap-2.5'
              onClick={() => navigate('/workspace/new')}
            >
              <span className='flex size-6 items-center justify-center rounded-md bg-muted'>
                <Plus className='size-3.5' strokeWidth={1.75} />
              </span>
              <span>{t('workspaceSwitcher.createWorkspace')}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
</DropdownMenuContent>
  )

  /* Dock 里的紧凑形态：只留工作区图标，名称走 title / 无障碍标签 */
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className='a-dock__brandbtn'
            title={`${displayName} · ${subtitle}`}
            aria-label={displayName}
          >
            <Logo className='size-[26px] text-primary' />
          </button>
        </DropdownMenuTrigger>
        {menuContent}
      </DropdownMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='h-auto gap-2.5 rounded-[10px] border border-border bg-surface/80 px-2.5 py-2 hover:bg-surface data-[active=true]:before:hidden group-data-[collapsible=icon]:size-10!'
            >
              <Logo className='size-7 shrink-0 text-primary' />
              {state === 'expanded' && (
                <>
                  <div className='grid min-w-0 flex-1 text-left leading-tight'>
                    <span
                      key={displayName}
                      className='animate-in fade-in slide-in-from-bottom-1 truncate text-[13px] font-medium duration-200'
                    >
                      {displayName}
                    </span>
                    <span className='truncate text-[12px] font-normal text-muted-foreground'>
                      {subtitle}
                    </span>
                  </div>
                  <ChevronDown className='ml-auto size-3.5 shrink-0 text-muted-foreground' />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {menuContent}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
