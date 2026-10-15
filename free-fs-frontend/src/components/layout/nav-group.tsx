import { DropdownMenuGroup } from '@/components/ui/dropdown-menu'
/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { stabilizeWorkspacePath } from '@/lib/workspace-path'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  type NavCollapsible,
  type NavItem,
  type NavLink,
  type NavGroup as NavGroupProps,
  type SidebarNavIconPair,
} from './types'

function NavItemIcon({
  icon,
  active,
  className,
}: {
  icon: SidebarNavIconPair
  active: boolean
  className?: string
}) {
  const Cmp = active ? icon.fill : icon.line
  return (
    <Cmp
      strokeWidth={1.75}
      className={cn(
        'size-[18px] shrink-0 text-muted-foreground',
        active && 'text-primary',
        className
      )}
    />
  )
}

/** 将 sidebar-data 中的相对路径拼接为 /w/{slug}{path} */
function useSlugPrefix() {
  const { slug } = useParams<{ slug: string }>()
  return (path: string) => `/w/${slug}${path}`
}

/**
 * 从当前 URL 中剥离 /w/:slug 前缀，
 * 使 checkIsActive 能和 sidebar-data 中的相对路径进行匹配
 */
function stripSlugPrefix(fullPath: string): string {
  const match = fullPath.match(/^\/w\/[^/]+(.*)$/)
  return match ? match[1] || '/' : fullPath
}

export function NavGroup({ titleKey, items }: NavGroupProps) {
  const { t } = useTranslation('layout')
  const { state, isMobile } = useSidebar()
  const location = useLocation()
  const rawHref = stabilizeWorkspacePath(location.pathname) + location.search
  const href = stripSlugPrefix(rawHref)
  const prefix = useSlugPrefix()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(titleKey)}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.titleKey}-${item.url}`

          if (!item.items)
            return (
              <SidebarMenuLink
                key={key}
                item={item}
                href={href}
                prefix={prefix}
              />
            )

          if (state === 'collapsed' && !isMobile)
            return (
              <SidebarMenuCollapsedDropdown
                key={key}
                item={item}
                href={href}
                prefix={prefix}
              />
            )

          return (
            <SidebarMenuCollapsible
              key={key}
              item={item}
              href={href}
              prefix={prefix}
            />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}

function SidebarMenuLink({
  item,
  href,
  prefix,
}: {
  item: NavLink
  href: string
  prefix: (path: string) => string
}) {
  const { t } = useTranslation('layout')
  const { setOpenMobile } = useSidebar()
  const active = checkIsActive(href, item)
  const label = t(item.titleKey)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
      >
        <Link to={prefix(item.url)} onClick={() => setOpenMobile(false)}>
          {item.icon && <NavItemIcon icon={item.icon} active={active} />}
          <span className='sidebar-nav-label'>{label}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarMenuCollapsible({
  item,
  href,
  prefix,
}: {
  item: NavCollapsible
  href: string
  prefix: (path: string) => string
}) {
  const { t } = useTranslation('layout')
  const { setOpenMobile } = useSidebar()
  const parentActive = checkIsActive(href, item, true)
  const label = t(item.titleKey)
  return (
    <Collapsible
      asChild
      defaultOpen={parentActive}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={label}>
            {item.icon && <NavItemIcon icon={item.icon} active={parentActive} />}
            <span className='sidebar-nav-label'>{label}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180' />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.titleKey}>
                <SidebarMenuSubButton
                  asChild
                  isActive={checkIsActive(href, subItem)}
                >
                  <Link
                    to={prefix(subItem.url)}
                    onClick={() => setOpenMobile(false)}
                  >
                    {subItem.icon && (
                      <NavItemIcon
                        icon={subItem.icon}
                        active={checkIsActive(href, subItem)}
                      />
                    )}
                    <span className='sidebar-nav-label'>
                      {t(subItem.titleKey)}
                    </span>
                    {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function SidebarMenuCollapsedDropdown({
  item,
  href,
  prefix,
}: {
  item: NavCollapsible
  href: string
  prefix: (path: string) => string
}) {
  const { t } = useTranslation('layout')
  const parentActive = checkIsActive(href, item)
  const label = t(item.titleKey)
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={label}
            isActive={parentActive}
          >
            {item.icon && (
              <NavItemIcon icon={item.icon} active={parentActive} />
            )}
            <span className='sidebar-nav-label'>{label}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
<DropdownMenuGroup>
          <DropdownMenuLabel>
            {label} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => (
            <DropdownMenuItem key={`${sub.titleKey}-${sub.url}`} asChild>
              <Link
                to={prefix(sub.url)}
                className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
              >
                {sub.icon && (
                  <NavItemIcon
                    icon={sub.icon}
                    active={checkIsActive(href, sub)}
                  />
                )}
                <span className='max-w-52 text-wrap'>{t(sub.titleKey)}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
</DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  const [hrefPath, hrefSearch = ''] = href.split('?')
  const [itemPath, itemSearch = ''] = (item.url ?? '').split('?')

  if (item.items?.some((i) => i.url === href)) return true

  // /files 与 /files?view=favorites 路径相同，必须按 view 区分，否则「全部文件」会跟着亮
  if (hrefPath === itemPath) {
    const hrefView = new URLSearchParams(hrefSearch).get('view')
    const itemView = new URLSearchParams(itemSearch).get('view')
    return hrefView === itemView
  }

  return (
    mainNav &&
    href.split('/')[1] !== '' &&
    href.split('/')[1] === item?.url?.split('/')[1]
  )
}
