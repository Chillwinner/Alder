/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  ArrowLeftRight,
  Folder,
  FolderArchive,
  House,
  ListTodo,
  NotebookPen,
  Star,
  Trash2,
  Video,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: '',
    email: 'user@example.com',
    avatar: '/avatars/default.jpg',
  },
  teams: [],
  navGroups: [
    {
      titleKey: 'sidebar.groups.main',
      items: [
        {
          titleKey: 'sidebar.nav.home',
          url: '/',
          icon: { line: House, fill: House },
        },
        {
          titleKey: 'sidebar.nav.allFiles',
          url: '/files',
          icon: { line: Folder, fill: Folder },
          permission: 'file:read',
        },
        {
          titleKey: 'sidebar.nav.favorites',
          url: '/files?view=favorites',
          icon: { line: Star, fill: Star },
        },
        {
          titleKey: 'sidebar.nav.transfer',
          url: '/transfer',
          icon: { line: ArrowLeftRight, fill: ArrowLeftRight },
        },
      ],
    },
    {
      titleKey: 'sidebar.groups.library',
      items: [
        {
          titleKey: 'sidebar.nav.collections',
          url: '/files?view=collections',
          icon: { line: FolderArchive, fill: FolderArchive },
          permission: 'file:share',
        },
        {
          titleKey: 'sidebar.nav.board',
          url: '/board',
          icon: { line: NotebookPen, fill: NotebookPen },
        },
        {
          titleKey: 'sidebar.nav.meetings',
          url: '/meetings',
          icon: { line: Video, fill: Video },
        },
        {
          titleKey: 'sidebar.nav.progress',
          url: '/progress',
          icon: { line: ListTodo, fill: ListTodo },
        },
      ],
    },
  ],
}

export const sidebarTrashItem = {
  titleKey: 'sidebar.nav.recycle' as const,
  url: '/files?view=recycle',
  icon: { line: Trash2, fill: Trash2 },
  permission: 'file:write' as const,
}
