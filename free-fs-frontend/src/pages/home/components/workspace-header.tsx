/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Upload, UserPlus } from 'lucide-react'
import { StartVoteButton } from './start-vote-button'
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
import { Skeleton } from '@/components/ui/skeleton'

function greetingKey() {
  const hour = new Date().getHours()
  if (hour < 12) return 'welcome.morning'
  if (hour < 18) return 'welcome.afternoon'
  return 'welcome.evening'
}

export function WorkspaceHeader({ unit }: { unit: HomeUsedBytesUnit }) {
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

  if (isLoading && !workspace) {
    return (
      <header className='a-phead'>
        <div className='flex flex-col min-w-0 flex-1 gap-2.5'>
          <Skeleton className='h-3.5 w-32' />
          <Skeleton className='h-9 w-64' />
        </div>
      </header>
    )
  }

  const today = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <header className='a-phead'>
      <div className='min-w-0'>
        <span className='a-eyebrow'>{today}</span>
        <h1 className='truncate'>{t(greetingKey())}，{workspace?.name ?? '—'}</h1>
        <p className='a-sub'>
          {filePage?.total != null && (
            <>
              {t('welcome.filesStat', { count: filePage.total })} ·{' '}
            </>
          )}
          {t('welcome.membersStat', { count: workspace?.memberCount ?? 0 })} ·
          已用 {storageLabel}
        </p>
      </div>

      <div className='a-phead__right'>
        {hasPermission('file:write') ? (
          <button
            type='button'
            className='a-btn a-btn--primary'
            onClick={() => navigate(`/w/${slug}/files?upload=1`)}
          >
            <Upload className='size-4' strokeWidth={1.9} />
            {t('welcome.upload')}
          </button>
        ) : null}
        {hasPermission('member:manage') ? (
          <button
            type='button'
            className='a-btn a-btn--ghost'
            onClick={() => openSettings('members')}
          >
            <UserPlus className='size-4' strokeWidth={1.9} />
            {t('welcome.invite')}
          </button>
        ) : null}
        <StartVoteButton />
      </div>
    </header>
  )
}
