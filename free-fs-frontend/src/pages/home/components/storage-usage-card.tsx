/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  getHomeInfo,
  getHostLoad,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesUnit,
} from '@/api/home'
import { getFileList } from '@/api/file'
import type { FileType } from '@/types/file'
import { formatHomeStorageDisplay } from '@/utils/format'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { usePermission } from '@/hooks/use-permission'

/**
 * 右栏控制台：上面两个环是本机 CPU / 内存，下面是文件构成。
 * 百分比写在环心里，名称写在环下面，不再叠一层横条。
 */
function formatHostBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

/** 类型构成的固定顺序，颜色和文件图标一致。 */
const SEGMENTS: { type: FileType; titleKey: string; color: string }[] = [
  { type: 'document', titleKey: 'category.document', color: 'var(--t-doc)' },
  { type: 'image', titleKey: 'category.image', color: 'var(--t-image)' },
  { type: 'video', titleKey: 'category.video', color: 'var(--t-video)' },
  { type: 'audio', titleKey: 'category.audio', color: 'var(--t-audio)' },
  { type: 'other', titleKey: 'category.other', color: 'var(--t-archive)' },
]

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

function Gauge({
  value,
  valueColor,
  children,
}: {
  value: number
  valueColor: string
  children?: ReactNode
}) {
  const pct = Math.max(0, Math.min(1, value))
  const len = pct * RING_C
  return (
    <div className='hb-gauge-wrap'>
      <svg viewBox='0 0 128 128' aria-hidden>
        <circle cx='64' cy='64' r={RING_R} fill='none' stroke='var(--surface-3)' strokeWidth='13' />
        <circle
          cx='64'
          cy='64'
          r={RING_R}
          fill='none'
          stroke={valueColor}
          strokeWidth='13'
          strokeLinecap='round'
          strokeDasharray={`${len} ${RING_C - len}`}
          strokeDashoffset={0}
          transform='rotate(-90 64 64)'
          style={{ transition: 'stroke-dasharray 900ms var(--ease-glide)' }}
        />
      </svg>
      <div className='hb-gauge-center'>{children}</div>
    </div>
  )
}

export function StorageOverviewCard({
  className,
  storageUnit,
}: {
  className?: string
  storageUnit: HomeUsedBytesUnit
}) {
  const { t } = useTranslation('home')
  const { slug } = useParams<{ slug: string }>()
  const { openSettings } = useSettingsModal()
  const { hasPermission } = usePermission()
  const canManageStorage = hasPermission('storage:manage')
  const canRead = hasPermission('file:read')

  const { data, isLoading } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, storageUnit],
    queryFn: () => getHomeInfo({ unit: storageUnit }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })
  const loadQuery = useQuery({
    queryKey: ['home-host-load'],
    queryFn: getHostLoad,
    staleTime: 2_000,
    refetchInterval: 4_000,
    retry: 1,
  })
  const loadUnavailable =
    !loadQuery.isPending && (loadQuery.isError || loadQuery.data == null)

  const counts = useQueries({
    queries: SEGMENTS.map((s) => ({
      queryKey: ['category-count', slug, s.type],
      queryFn: () => getFileList({ page: 1, pageSize: 1, fileType: s.type }),
      enabled: canRead,
      staleTime: 60_000,
    })),
  })

  const usedStorage = data?.usedStorage
  const unitLabel = data?.unit ?? ''
  const display =
    usedStorage === undefined
      ? '—'
      : formatHomeStorageDisplay(usedStorage, unitLabel, storageUnit)

  const rows = SEGMENTS.map((s, i) => ({
    ...s,
    count: counts[i]?.data?.total ?? 0,
  }))
  const totalFiles = rows.reduce((sum, r) => sum + r.count, 0)

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='mt-5 h-[132px] w-full' />
      </div>
    )
  }

  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0)
  const cpu = loadUnavailable ? 0 : Math.max(0, Math.min(1, loadQuery.data?.cpu ?? 0))
  const mem = loadUnavailable ? 0 : Math.max(0, Math.min(1, loadQuery.data?.memory ?? 0))
  const memUsed = formatHostBytes(loadQuery.data?.memoryUsedBytes ?? 0)
  const memTotal = formatHostBytes(loadQuery.data?.memoryTotalBytes ?? 0)
  const unavailable = t('storageCard.unavailable')
  const cpuText = loadUnavailable ? unavailable : `${Math.round(cpu * 100)}%`
  const memText = loadUnavailable ? unavailable : `${Math.round(mem * 100)}%`
  const memNote = loadUnavailable ? undefined : t('storageCard.memorySub', { used: memUsed, total: memTotal })

  return (
    <div className={className ? `hb-console ${className}` : 'hb-console'}>
      <section className='hb-console__block' aria-label={t('storageCard.consoleTitle')}>
        <div className='hb-console__head'>
          <h3 className='hb-console__kicker'>{t('storageCard.consoleTitle')}</h3>
        </div>
        <div className='hb-gauges'>
          <div className='hb-gauge-cell'>
            <Gauge value={cpu} valueColor={cpu >= 0.9 ? '#e24b4a' : 'var(--primary)'}>
              <div className='hb-gauge-num'>{cpuText}</div>
            </Gauge>
            <div className='hb-gauge-sub'>{t('storageCard.cpu')}</div>
          </div>
          <div className='hb-gauge-cell'>
            <Gauge value={mem} valueColor={mem >= 0.9 ? '#e24b4a' : 'var(--t-image)'}>
              <div className='hb-gauge-num'>{memText}</div>
            </Gauge>
            <div className='hb-gauge-sub'>{t('storageCard.memory')}</div>
            {memNote ? <div className='hb-gauge-sub'>{memNote}</div> : null}
          </div>
        </div>
      </section>

      <section className='hb-console__block' aria-label={t('storageCard.filesHeading')}>
        <div className='hb-console__head'>
          <h3 className='hb-console__kicker'>{t('storageCard.filesHeading')}</h3>
          <span className='hb-console__meta'>{totalFiles}</span>
        </div>
        <div className='hb-console__rows'>
          {rows.map((row) => (
            <Link
              key={row.type}
              to={`/w/${slug}/files?type=${row.type}`}
              className='hb-fileline'
            >
              <i className='hb-fileline__swatch' style={{ background: row.color }} />
              <span className='hb-fileline__name'>{t(row.titleKey)}</span>
              <span className='hb-fileline__num'>{row.count}</span>
              <span className='hb-fileline__track' aria-hidden>
                <i
                  style={{
                    background: row.color,
                    width: maxCount > 0 ? `${(row.count / maxCount) * 100}%` : '0%',
                  }}
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className='hb-console__foot'>
        <span className='hb-console__used'>{display}</span>
        {canManageStorage ? (
          <button
            type='button'
            onClick={() => openSettings('storage')}
            className='a-btn a-btn--ghost a-btn--sm'
          >
            {t('storageCard.manage')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
