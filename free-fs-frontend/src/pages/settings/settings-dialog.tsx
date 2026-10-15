/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  ArrowLeftRight,
  Building2,
  HardDrive,
  Palette,
  ScrollText,
  Shield,
  UserRound,
  Users,
  Keyboard,
  Server,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { NoPermission } from '@/components/no-permission'
import {
  useSettingsModal,
  type SettingsTab,
} from '@/contexts/settings-modal-context'
import { usePermission } from '@/hooks/use-permission'
import type { SidebarNavIconPair } from '@/components/layout/types'
import type { PermissionCodeType } from '@/types/permission'
import { SettingsProfile } from './profile'
import { SettingsAppearance } from './appearance'
import { SettingsTransfer } from './transfer'
import { SettingsWorkspace } from './workspace'
import { SettingsMembers } from './members'
import { SettingsRoles } from './roles'
import { SettingsLogs } from './activity-log'
import { SettingsImCrypto } from './im-crypto'
import { SettingsShortcuts } from './shortcuts'
import { SettingsSite } from './site'
import StoragePage from '@/pages/storage'
import { SidebarNav, type SettingsNavGroup } from './components/sidebar-nav'
import './settings.css'

interface NavItemConfig {
  title: string
  tab: SettingsTab
  icon: SidebarNavIconPair
  permission?: PermissionCodeType
}

function buildNavConfig(
  t: TFunction<'settings'>
): { label: string; items: NavItemConfig[] }[] {
  return [
    {
      label: t('nav.groupAccount'),
      items: [
        {
          title: t('nav.profile'),
          tab: 'profile',
          icon: { line: UserRound, fill: UserRound },
        },
        {
          title: t('nav.preference'),
          tab: 'appearance',
          icon: { line: Palette, fill: Palette },
        },
        {
          title: t('nav.shortcuts'),
          tab: 'shortcuts',
          icon: { line: Keyboard, fill: Keyboard },
        },
        {
          title: t('nav.transfer'),
          tab: 'transfer',
          icon: { line: ArrowLeftRight, fill: ArrowLeftRight },
        },
      ],
    },
    {
      label: t('nav.groupSite'),
      items: [
        {
          title: t('nav.site'),
          tab: 'site',
          icon: { line: Server, fill: Server },
          permission: 'storage:manage',
        },
      ],
    },
    {
      label: t('nav.groupWorkspace'),
      items: [
        {
          title: t('nav.workspace'),
          tab: 'workspace',
          icon: { line: Building2, fill: Building2 },
          permission: 'member:manage',
        },
        {
          title: t('nav.storage'),
          tab: 'storage',
          icon: { line: HardDrive, fill: HardDrive },
          permission: 'storage:manage',
        },
        {
          title: t('nav.members'),
          tab: 'members',
          icon: { line: Users, fill: Users },
        },
        {
          title: t('nav.roles'),
          tab: 'roles',
          icon: { line: Shield, fill: Shield },
          permission: 'member:manage',
        },
        {
          title: t('nav.logs'),
          tab: 'logs',
          icon: { line: ScrollText, fill: ScrollText },
          permission: 'log:read',
        },
      ],
    },
  ]
}

function toNavGroups(
  config: ReturnType<typeof buildNavConfig>,
  hasPermission: (p: PermissionCodeType) => boolean
): SettingsNavGroup[] {
  return config
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => !item.permission || hasPermission(item.permission))
        .map(({ title, tab, icon }) => ({
          title,
          tab,
          icon,
        })),
    }))
    .filter((g) => g.items.length > 0)
}

function SettingsPanel({ tab }: { tab: SettingsTab }) {
  const { hasPermission } = usePermission()

  switch (tab) {
    case 'profile':
      return <SettingsProfile />
    case 'appearance':
      return <SettingsAppearance />
    case 'transfer':
      return <SettingsTransfer />
    case 'workspace':
      return hasPermission('member:manage') ? (
        <SettingsWorkspace />
      ) : (
        <NoPermission />
      )
    case 'storage':
      return hasPermission('storage:manage') ? (
        <StoragePage embedded />
      ) : (
        <NoPermission />
      )
    case 'members':
      return <SettingsMembers />
    case 'roles':
      return hasPermission('member:manage') ? (
        <SettingsRoles />
      ) : (
        <NoPermission />
      )
    case 'logs':
      return hasPermission('log:read') ? (
        <SettingsLogs />
      ) : (
        <NoPermission />
      )
    case 'imCrypto':
      return <SettingsImCrypto />
    case 'shortcuts':
      return <SettingsShortcuts />
    case 'site':
      return hasPermission('storage:manage') ? <SettingsSite /> : <NoPermission />
    default:
      return <SettingsProfile />
  }
}

export function SettingsDialog() {
  const { t } = useTranslation('settings')
  const { open, setOpen, tab, setTab } = useSettingsModal()
  const { hasPermission } = usePermission()

  const navGroups = useMemo(
    () => toNavGroups(buildNavConfig(t), hasPermission),
    [hasPermission, t]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='glass-card flex h-[min(92vh,960px)] max-h-[92vh] w-[min(1240px,calc(100%-32px))] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-none'>
        <div className='flex h-14 shrink-0 items-center gap-2.5 border-b border-divider bg-surface/45 ps-6 pe-20 md:ps-8'>
          <DialogTitle className='text-[15px] font-semibold tracking-tight'>
            {t('dialog.title')}
          </DialogTitle>
        </div>

        <div className='flex min-h-0 min-w-0 flex-1 flex-col md:flex-row'>
          <SidebarNav
            groups={navGroups}
            activeTab={tab}
            onSelectTab={setTab}
          />
          <div className='min-h-0 min-w-0 flex-1 overflow-y-auto bg-background px-6 py-6 sm:px-8 md:px-10 md:py-8'>
            <div
              key={tab}
              className='set-panel mx-auto flex w-full max-w-[960px] flex-col'
            >
              <SettingsPanel tab={tab} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
