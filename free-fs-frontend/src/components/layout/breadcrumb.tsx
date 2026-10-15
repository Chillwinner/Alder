/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { useLocation, Link } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const BREADCRUMB_PATH_KEYS: Record<string, string> = {
  '/': 'home',
  '/files': 'allFiles',
  '/transfer': 'transfer',
  '/board': 'board',
  '/votes': 'meetings',
  '/meetings': 'meetings',
  '/progress': 'progress',
  '/progress/month': 'progressMonth',
  '/progress/mine': 'progressMine',
  '/notifications': 'notifications',
  '/storage': 'storage',
  '/settings': 'settings',
  '/settings/appearance': 'appearance',
  '/settings/transfer': 'transferSettings',
}

const FILE_VIEW_KEYS: Record<string, string> = {
  favorites: 'favorites',
  collections: 'collections',
  recycle: 'recycle',
}

const FILE_TYPE_KEYS: Record<string, string> = {
  document: 'filesDocument',
  image: 'filesImage',
  video: 'filesVideo',
  audio: 'filesAudio',
  other: 'filesOther',
}

function parseSegments(pathname: string): { homeHref: string; segments: string[] } {
  const ws = pathname.match(/^(\/w\/[^/]+)(?:\/(.*))?$/)
  if (ws) {
    const base = ws[1]
    const tail = ws[2]
    const segments = tail ? tail.split('/').filter(Boolean) : []
    return { homeHref: `${base}/`, segments }
  }
  return {
    homeHref: '/',
    segments: pathname.split('/').filter(Boolean),
  }
}

export function AppBreadcrumb() {
  const { t } = useTranslation('layout')
  const location = useLocation()
  const { segments } = parseSegments(location.pathname)
  if (segments[0] === 'board') segments.length = 1
  const params = new URLSearchParams(location.search)
  const fileView = params.get('view')
  const fileType = params.get('type')
  const extraKey =
    segments[0] === 'files'
      ? (fileView && FILE_VIEW_KEYS[fileView]) ||
        (fileType && FILE_TYPE_KEYS[fileType]) ||
        null
      : null

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{t('breadcrumb.home')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const ws = location.pathname.match(/^(\/w\/[^/]+)/)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1 && !extraKey
          const logicalPath = `/${segments.slice(0, index + 1).join('/')}`
          const key = BREADCRUMB_PATH_KEYS[logicalPath]
          const name = key ? t(`breadcrumb.${key}`) : segment
          const pathHref = ws
            ? `${ws[1]}/${segments.slice(0, index + 1).join('/')}`
            : `/${segments.slice(0, index + 1).join('/')}`

          return (
            <div key={pathHref} className='flex items-center gap-1.5'>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={pathHref}>{name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          )
        })}
        {extraKey ? (
          <div className='flex items-center gap-1.5'>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t(`breadcrumb.${extraKey}`)}</BreadcrumbPage>
            </BreadcrumbItem>
          </div>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
