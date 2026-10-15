/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { FolderPlus, Upload, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesUnit,
} from '@/api/home'
import { getFileList } from '@/api/file'
import { formatHomeStorageDisplay } from '@/utils/format'
import { usePermission } from '@/hooks/use-permission'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { useWorkspaceStore } from '@/store/workspace'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function greetingKey() {
  const hour = new Date().getHours()
  if (hour < 12) return 'welcome.morning'
  if (hour < 18) return 'welcome.afternoon'
  return 'welcome.evening'
}

export function WorkspaceSummary({ unit }: { unit: HomeUsedBytesUnit }) {
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const { hasPermission } = usePermission()
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((item) => item.id === s.currentWorkspaceId)
  )

  const { data, isLoading } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, unit],
    queryFn: () => getHomeInfo({ unit }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const canRead = hasPermission('file:read')
  const { data: filePage } = useQuery({
    queryKey: ['workspace-file-total', slug],
    queryFn: () => getFileList({ page: 1, pageSize: 1 }),
    enabled: canRead,
    staleTime: 60_000,
  })

  const storageLabel =
    data?.usedStorage === undefined
      ? '—'
      : formatHomeStorageDisplay(data.usedStorage, data.unit ?? '', unit)
  const members = workspace?.memberCount ?? 0
  const files = filePage?.total
  const meta =
    files == null
      ? t('welcome.metaNoFiles', { members, storage: storageLabel })
      : t('welcome.meta', { files, members, storage: storageLabel })

  if (isLoading && !workspace) {
    return (
      <header className='mb-6 flex items-end justify-between gap-4'>
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-4 w-56' />
        </div>
      </header>
    )
  }

  return (
    <header className='mb-6 flex flex-wrap items-end justify-between gap-4'>
      <div className='flex flex-col min-w-0 gap-1.5'>
        <p className='tech-eyebrow'>工作台</p>
        <h1 className='truncate text-[26px] font-semibold tracking-tight'>
          {workspace?.name ?? '—'}
        </h1>
        <p className='text-[13.5px] text-muted-foreground'>{t(greetingKey())}</p>
        <p className='font-mono text-xs tabular-nums text-muted-foreground'>{meta}</p>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {hasPermission('file:write') ? (
          <>
            <Button
              size='sm'
              className='h-8'
              onClick={() => navigate(`/w/${slug}/files`)}
            >
              <Upload className='size-3.5' strokeWidth={1.75} />
              {t('welcome.upload')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-8'
              onClick={() => navigate(`/w/${slug}/files`)}
            >
              <FolderPlus className='size-3.5' strokeWidth={1.75} />
              {t('welcome.newFolder')}
            </Button>
          </>
        ) : null}
        {hasPermission('member:manage') ? (
          <Button
            size='sm'
            variant='ghost'
            className='h-8'
            onClick={() => openSettings('members')}
          >
            <UserPlus className='size-3.5' strokeWidth={1.75} />
            {t('welcome.invite')}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
