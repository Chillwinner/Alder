/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import * as React from 'react'
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
 * 存储 hero —— 双仪表盘。
 *
 * 版式沿用 demo（环 + 大数字 + 图例 + 页脚），但**不造数据**。
 *
 * 双环改成看本机负载：左 CPU、右内存。类型构成仍用下面图例。
 */
function formatHostBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

/** 类型构成环形图用的固定顺序 + 配色（与文件图标色板同源） */
const SEGMENTS: { type: FileType; titleKey: string; color: string }[] = [
  { type: 'document', titleKey: 'category.document', color: 'var(--t-doc)' },
  { type: 'image', titleKey: 'category.image', color: 'var(--t-image)' },
  { type: 'video', titleKey: 'category.video', color: 'var(--t-video)' },
  { type: 'audio', titleKey: 'category.audio', color: 'var(--t-audio)' },
  { type: 'other', titleKey: 'category.other', color: 'var(--t-archive)' },
]

/** 单环骨架：底环 + 顶部数据环，两个仪表盘共用 */
function Gauge({
  value,
  valueColor,
  children,
}: {
  /** 0~1，决定环画多少。⚠️ 传 1 就是满圆 = 100%，只有真的 100% 才能传 1 */
  value: number
  valueColor: string
  children?: React.ReactNode
}) {
  const pct = Math.max(0, Math.min(1, value))
  const len = pct * RING_C
  return (
    <div className='hb-gauge-wrap'>
      <svg viewBox='0 0 128 128' aria-hidden>
        <circle
          cx='64'
          cy='64'
          r={RING_R}
          fill='none'
          stroke='var(--surface-3)'
          strokeWidth='13'
        />
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

  return (
    <div className={className}>
      <div className='a-bcell__head'>
        <h3>{t('storageCard.title')}</h3>
        {/*
          ⚠️ 这里原来是 <span className='a-tag'>…</span> —— 一个**长得像按钮但不可点**
             的胶囊（用户反馈"快速访问按钮没作用"，指的就是它）。
             胶囊形状在 demo 里是用来表示"可操作的"，用作纯标签会误导。
             现在改成真的 Link：跳文件页，并且带上当前筛选语义。
        */}
        <Link
          to={`/w/${slug}/files`}
          className='a-tag a-tag--accent transition-colors hover:brightness-110'
        >
          {totalFiles} {t('category.title')}
        </Link>
      </div>

      <div className='hb-gauges'>
        <div className='hb-gauge-cell'>
          <Gauge value={cpu} valueColor='var(--primary)'>
            <span>{t('storageCard.cpu')}</span>
          </Gauge>
          <div className='hb-gauge-num'>
            {loadUnavailable ? (
              <small>{unavailable}</small>
            ) : (
              <>
                {Math.round(cpu * 100)}
                <small>%</small>
              </>
            )}
          </div>
          <div className='hb-gauge-sub'>{t('storageCard.cpuSub')}</div>
        </div>

        <div className='hb-gauge-cell'>
          <Gauge value={mem} valueColor='var(--t-image)'>
            <span>{t('storageCard.memory')}</span>
          </Gauge>
          <div className='hb-gauge-num'>
            {loadUnavailable ? (
              <small>{unavailable}</small>
            ) : (
              <>
                {Math.round(mem * 100)}
                <small>%</small>
              </>
            )}
          </div>
          <div className='hb-gauge-sub'>
            {loadUnavailable
              ? unavailable
              : t('storageCard.memorySub', { used: memUsed, total: memTotal })}
          </div>
        </div>
      </div>

      <div className='a-legend a-legend--grid a-legend--spaced'>
        {rows.map((r) => (
          <div key={r.type}>
            <i style={{ background: r.color }} />
            {t(r.titleKey)}
            <b>{r.count}</b>
            {/* 迷你条：让每类的量级一眼可比，而不是只有数字 */}
            <span className='a-legend__bar' aria-hidden>
              <i
                style={{
                  background: r.color,
                  width: maxCount > 0 ? `${(r.count / maxCount) * 100}%` : '0%',
                }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className='a-hero-foot'>
        <div className='a-person' style={{ gap: 9, flex: 1 }}>
          <span className='a-state-dot a-state-dot--on' />
          <span className='a-sub' style={{ margin: 0 }}>
            {t('storageCard.foot', { count: totalFiles, used: display })}
          </span>
        </div>
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
