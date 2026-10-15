/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import { Archive, FileText, Film, Image, Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type CategoryShortcut = {
  title: string
  href: string
  icon: LucideIcon
}

export const buildCategoryShortcuts = (
  slug: string,
  t: TFunction
): CategoryShortcut[] => [
  {
    title: t('category.document'),
    href: `/w/${slug}/files?type=document`,
    icon: FileText,
  },
  {
    title: t('category.image'),
    href: `/w/${slug}/files?type=image`,
    icon: Image,
  },
  {
    title: t('category.video'),
    href: `/w/${slug}/files?type=video`,
    icon: Film,
  },
  {
    title: t('category.audio'),
    href: `/w/${slug}/files?type=audio`,
    icon: Music,
  },
  {
    title: t('category.other'),
    href: `/w/${slug}/files?type=other`,
    icon: Archive,
  },
]

export function CategoryShortcutLink({
  title,
  href,
  icon: Icon,
  className,
}: CategoryShortcut & { className?: string }) {
  const { t } = useTranslation('home')
  return (
    <Link
      to={href}
      className={cn(
        'group flex h-[88px] min-w-0 items-center gap-3 rounded-[10px] px-3 transition-all duration-150',
        'hover:-translate-y-0.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <Icon
        className='size-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground'
        strokeWidth={1.75}
        aria-hidden
      />
      <span className='min-w-0'>
        <span className='block truncate text-[13px] font-medium'>{title}</span>
        <span className='mt-0.5 block text-[12px] text-muted-foreground'>
          {t('category.browse')}
        </span>
      </span>
    </Link>
  )
}
