/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SettingsTab } from '@/contexts/settings-modal-context'
import type { SidebarNavIconPair } from '@/components/layout/types'

export type SettingsNavItem = {
  title: string
  tab: SettingsTab
  icon: SidebarNavIconPair
}

export type SettingsNavGroup = {
  label: string
  items: SettingsNavItem[]
}

type SidebarNavProps = React.HTMLAttributes<HTMLElement> & {
  groups: SettingsNavGroup[]
  activeTab: SettingsTab
  onSelectTab: (tab: SettingsTab) => void
}

/**
 * 设置弹窗左侧导航：iOS 设置风格。
 * 选中项 = accent-soft 底 + 主色文字 + 左侧指示条；窄屏退化为下拉。
 */
export function SidebarNav({
  className,
  groups,
  activeTab,
  onSelectTab,
  ...props
}: SidebarNavProps) {
  const { t } = useTranslation('settings')
  const [val, setVal] = useState(activeTab)

  useEffect(() => {
    setVal(activeTab)
  }, [activeTab])

  const handleSelect = (t: SettingsTab) => {
    setVal(t)
    onSelectTab(t)
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-sidebar md:h-full md:w-[236px] md:shrink-0 md:border-e md:border-divider',
        className
      )}
      {...props}
    >
      <div className='shrink-0 border-b border-divider p-2.5 md:hidden'>
        <Select
          value={val}
          onValueChange={(t) => handleSelect(t as SettingsTab)}
        >
          <SelectTrigger className='a-input set-select w-full'>
            <SelectValue placeholder={t('sidebar.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className='text-muted-foreground'>
                  {group.label}
                </SelectLabel>
                {group.items.map((item) => {
                  const isActive = val === item.tab
                  const Cmp = isActive ? item.icon.fill : item.icon.line
                  return (
                    <SelectItem key={item.tab} value={item.tab}>
                      <div className='flex gap-x-3 px-1 py-0.5'>
                        <span className='flex shrink-0 items-center'>
                          <Cmp className='size-4' />
                        </span>
                        <span>{item.title}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav className='set-nav hidden flex-1 md:flex'>
        {groups.map((group) => (
          <div key={group.label} className='set-nav__group'>
            <p className='set-nav__grouplabel'>{group.label}</p>
            <div className='set-nav__list'>
              {group.items.map((item) => {
                const isActive = activeTab === item.tab
                const Cmp = isActive ? item.icon.fill : item.icon.line
                return (
                  <button
                    key={item.tab}
                    type='button'
                    data-settings-nav-item=''
                    data-active={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    className='set-nav__item'
                    onClick={() => onSelectTab(item.tab)}
                  >
                    <Cmp className='size-4 shrink-0' strokeWidth={1.85} aria-hidden />
                    <span className='truncate'>{item.title}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
