/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PermissionCodeType } from '@/types/permission'

/** 侧边栏导航图标。line / fill 可相同（Lucide 单套线标） */
type SidebarNavIconPair = {
  line: React.ElementType<{ className?: string; strokeWidth?: number }>
  fill: React.ElementType<{ className?: string; strokeWidth?: number }>
}

type User = {
  name: string
  email: string
  avatar: string
}

type Team = {
  name: string
  logo: React.ElementType
  plan: string
}

type BaseNavItem = {
  /** i18n key under `layout` namespace, e.g. sidebar.nav.home */
  titleKey: string
  badge?: string
  icon?: SidebarNavIconPair
  permission?: PermissionCodeType
}

type NavLink = BaseNavItem & {
  url: string
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  titleKey: string
  items: NavItem[]
}

type SidebarData = {
  user: User
  teams: Team[]
  navGroups: NavGroup[]
}

export type {
  SidebarData,
  NavGroup,
  NavItem,
  NavCollapsible,
  NavLink,
  SidebarNavIconPair,
}
