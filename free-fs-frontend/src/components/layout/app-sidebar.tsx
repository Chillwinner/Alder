/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Settings, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
import { WorkspaceSwitcher } from './workspace-switcher'
import { sidebarData, sidebarTrashItem } from './data/sidebar-data'
import { NavGroup } from './nav-group'

function stripSlugPrefix(fullPath: string): string {
  const match = fullPath.match(/^\/w\/[^/]+(.*)$/)
  return match ? match[1] || '/' : fullPath
}

function SettingsButton() {
  const { t } = useTranslation('layout')
  const { openSettings } = useSettingsModal()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          type='button'
          tooltip={t('sidebar.settings')}
          onClick={() => openSettings('profile')}
        >
          <Settings
            strokeWidth={1.75}
            className='size-[18px] text-muted-foreground'
          />
          <span className='sidebar-nav-label'>{t('sidebar.settings')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function TrashLink() {
  const { t } = useTranslation('layout')
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const href = stripSlugPrefix(location.pathname + location.search)
  const [hrefPath, hrefSearch = ''] = href.split('?')
  const [itemPath, itemSearch = ''] = sidebarTrashItem.url.split('?')
  const active =
    hrefPath === itemPath &&
    new URLSearchParams(hrefSearch).get('view') ===
      new URLSearchParams(itemSearch).get('view')
  const label = t(sidebarTrashItem.titleKey)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={label}>
          <Link
            to={`/w/${slug}${sidebarTrashItem.url}`}
            onClick={() => setOpenMobile(false)}
          >
            <Trash2
              strokeWidth={1.75}
              className={cn(
                'size-[18px]',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className='sidebar-nav-label'>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { hasPermission } = usePermission()

  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0)

  const showTrash =
    !sidebarTrashItem.permission || hasPermission(sidebarTrashItem.permission)

  return (
    <Sidebar variant='floating' collapsible='icon'>
      <SidebarHeader className='px-2 pt-3'>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className='gap-1 pt-1'>
        {navGroups.map((group) => (
          <Fragment key={group.titleKey}>
            <NavGroup titleKey={group.titleKey} items={group.items} />
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter className='gap-0.5 pb-3'>
        {showTrash && <TrashLink />}
        <SettingsButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
