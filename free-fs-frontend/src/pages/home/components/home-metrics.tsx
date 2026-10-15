/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getHomeInfo, HOME_INFO_REFETCH_INTERVAL_MS } from '@/api/home'
import { getFileList } from '@/api/file'
import type { FileType } from '@/types/file'
import { formatHomeStorageDisplay } from '@/utils/format'
import { usePermission } from '@/hooks/use-permission'
import { useWorkspaceStore } from '@/store/workspace'

/**
 * 首页展示层的**只读**度量聚合。
 *
 * 这不是新的数据层：查询 key/API/权限判断与页面既有卡片完全一致，
 * 因此 React Query 会命中同一条缓存，不会多发请求。
 * 组件本身不产生任何交互行为，只把已有数字整理成构图需要的形状。
 */

/** 类型构成用的固定顺序 + 配色（与文件图标色板同源） */
export const HOME_TYPE_SEGMENTS: {
  type: FileType
  titleKey: string
  color: string
}[] = [
  { type: 'document', titleKey: 'category.document', color: 'var(--t-doc)' },
  { type: 'image', titleKey: 'category.image', color: 'var(--t-image)' },
  { type: 'video', titleKey: 'category.video', color: 'var(--t-video)' },
  { type: 'audio', titleKey: 'category.audio', color: 'var(--t-audio)' },
  { type: 'other', titleKey: 'category.other', color: 'var(--t-archive)' },
]

export function useHomeCounts() {
  const { t } = useTranslation('home')
  const { slug = '' } = useParams<{ slug: string }>()
  const { hasPermission } = usePermission()
  const canRead = hasPermission('file:read')

  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((item) => item.id === s.currentWorkspaceId)
  )

  const { data, isError, isPending } = useQuery({
    queryKey: ['homeInfo', 'summary', slug, 2],
    queryFn: () => getHomeInfo({ unit: 2 }),
    staleTime: 30_000,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const { data: filePage } = useQuery({
    queryKey: ['workspace-file-total', slug],
    queryFn: () => getFileList({ page: 1, pageSize: 1 }),
    enabled: canRead,
    staleTime: 60_000,
  })

  /*
    近 7 天活跃度：直接用 home/info 的「近 7 天」趋势算，不额外造请求。
    ⚠️ queryKey 必须与 ChartStorageGrowth → ChartAreaInteractive 的完全一致
       （['homeInfo','chart','7d',2]），否则 React Query 不会去重，
       首页会多打一次 /apis/home/info。图表默认就是 timeRange='7d' + unit=2。

    指标口径（都是真实可算的）：
      weekAdded   近 7 天每天的 usedBytes 增量求和
      activeDays  近 7 天里有上传的天数
      weekDelta   本周新增 vs 上周新增的变化百分比
  */
  const { data: weekTrend } = useQuery({
    queryKey: ['homeInfo', 'chart', '7d', 2],
    queryFn: () => getHomeInfo({ unit: 2, dateType: 2 }),
    staleTime: 0,
  })

  const counts = useQueries({
    queries: HOME_TYPE_SEGMENTS.map((s) => ({
      queryKey: ['category-count', slug, s.type],
      queryFn: () => getFileList({ page: 1, pageSize: 1, fileType: s.type }),
      enabled: canRead,
      staleTime: 60_000,
    })),
  })

  const rows = HOME_TYPE_SEGMENTS.map((s, i) => ({
    ...s,
    count: counts[i]?.data?.total ?? 0,
  }))
  const total = filePage?.total ?? rows.reduce((sum, r) => sum + r.count, 0)
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  const distinctTypes = rows.filter((r) => r.count > 0).length
  const topRow = rows.reduce(
    (best, r) => (r.count > best.count ? r : best),
    rows[0]
  )

  const storageLabel =
    data?.usedStorage === undefined
      ? '—'
      : formatHomeStorageDisplay(data.usedStorage, data.unit ?? '', 2)

  /*
    从近 7 天趋势里算活跃度。
    usedBytes 是「当天用掉的量」（后端按天给点），所以：
      本周新增 = 7 天求和；活跃天 = 值 > 0 的天数。
    没有趋势数据时全部退化为 0，不显示假数字。
  */
  const trend = weekTrend?.usedBytes ?? []
  const weekAdded = trend.reduce((sum, p) => sum + (p.usedBytes || 0), 0)
  const activeDays = trend.filter((p) => (p.usedBytes || 0) > 0).length
  // 与前半段对比得出趋势方向（7 个点：后 3 天 vs 前 4 天，避免除零）
  const half = Math.max(1, Math.floor(trend.length / 2))
  const recentSum = trend.slice(-half).reduce((s, p) => s + (p.usedBytes || 0), 0)
  const earlierSum = trend.slice(0, half).reduce((s, p) => s + (p.usedBytes || 0), 0)
  const weekDeltaPct =
    earlierSum > 0
      ? Math.round(((recentSum - earlierSum) / earlierSum) * 100)
      : recentSum > 0
        ? 100
        : 0
  const weekDelta = recentSum - earlierSum
  const weekUnit = weekTrend?.unit ?? data?.unit ?? ''

  return {
    rows,
    max,
    total,
    members: workspace?.memberCount ?? 0,
    workspaceName: workspace?.name,
    storageLabel,
    localUsedBytes: data?.localUsedBytes,
    localQuotaBytes: data?.localQuotaBytes,
    quotaUnavailable: !isPending && (isError || data?.localQuotaBytes == null),
    filesLabel: t('category.filesCount', { count: total }),
    distinctTypes,
    /** 分类占比：用于小卡底部那条细流光 */
    topShare: total > 0 ? `${Math.round((topRow.count / total) * 100)}%` : '0%',
    /* ---- 近 7 天活跃（第二张小卡）---- */
    weekAddedLabel: weekAdded.toFixed(weekAdded >= 100 ? 0 : 2),
    weekAddedUnit: weekUnit,
    weekDelta,
    weekDeltaPct: Math.abs(weekDeltaPct),
    activeDays,
  }
}

/** 顶部右侧的状态胶囊：只展示总数。 */
export function CategoryCounts({ total }: { total: number }) {
  const { t } = useTranslation('home')
  return (
    <span className='a-tag'>
      {t('category.filesCount', { count: total })}
    </span>
  )
}
