/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  getHomeInfo,
  HOME_INFO_REFETCH_INTERVAL_MS,
  type HomeUsedBytesDateType,
  type HomeUsedBytesUnit,
} from '@/api/home'
import {
  formatHomeStorageDisplay,
  formatHomeStorageNumber,
} from '@/utils/format'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'

const UNIT_LABELS: Record<HomeUsedBytesUnit, string> = {
  1: 'KB',
  2: 'MB',
  3: 'GB',
}

const Y_AXIS_WIDTH: Record<HomeUsedBytesUnit, number> = {
  1: 64,
  2: 56,
  3: 52,
}

function timeRangeToDateType(range: string): HomeUsedBytesDateType {
  if (range === '30d') return 1
  if (range === '7d') return 2
  return 0
}

type ChartAreaInteractiveProps = {
  className?: string
  /** 由首页提升状态，与存储概览等单位联动 */
  unit: HomeUsedBytesUnit
  onUnitChange: (unit: HomeUsedBytesUnit) => void
}

export function ChartAreaInteractive({
  className,
  unit,
  onUnitChange,
}: ChartAreaInteractiveProps) {
  const { t, i18n } = useTranslation('home')
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('90d')
  const dateLocale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US'

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d')
    }
  }, [isMobile])

  const { data: home, isLoading, isError } = useQuery({
    queryKey: ['homeInfo', 'chart', timeRange, unit],
    queryFn: () =>
      getHomeInfo({
        unit,
        dateType: timeRangeToDateType(timeRange),
      }),
    /** 切换单位/时间范围后需重新请求，避免命中旧缓存不发起网络请求 */
    staleTime: 0,
    refetchInterval: HOME_INFO_REFETCH_INTERVAL_MS,
  })

  const unitLabel = home?.unit ?? UNIT_LABELS[unit]

  const chartConfig = React.useMemo(
    () =>
      ({
        used: {
          label: t('chart.seriesLabel', { unit: unitLabel }),
          color: 'var(--chart-1)',
        },
      }) satisfies ChartConfig,
    [unitLabel, t]
  )

  const chartData = React.useMemo(() => {
    const rawList = home?.usedBytes
    if (!rawList?.length) return []
    return rawList.map((row) => ({
      date: row.date,
      used: Number(row.usedBytes),
    }))
  }, [home?.usedBytes])

  const maxUsed = React.useMemo(
    () => chartData.reduce((m, d) => Math.max(m, d.used), 0),
    [chartData]
  )

  const areaStrokeWidth =
    unit >= 2 && maxUsed > 0 && maxUsed < 0.05 ? 2.5 : 1.5

  const weekDelta = React.useMemo(() => {
    if (chartData.length < 2) return null
    const last = chartData[chartData.length - 1]
    const lastDate = new Date(last.date)
    if (Number.isNaN(lastDate.getTime())) return null
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - 7)
    const earlier =
      [...chartData]
        .reverse()
        .find((row) => new Date(row.date).getTime() <= cutoff.getTime()) ??
      chartData[0]
    return last.used - earlier.used
  }, [chartData])

  const weekDeltaLabel = React.useMemo(() => {
    if (weekDelta == null) return null
    const formatted = formatHomeStorageDisplay(
      Math.abs(weekDelta),
      unitLabel,
      unit
    )
    if (Math.abs(weekDelta) < 1e-9) return t('chart.weekDeltaFlat')
    if (weekDelta > 0) return t('chart.weekDeltaUp', { value: formatted })
    return t('chart.weekDeltaDown', { value: `-${formatted}` })
  }, [weekDelta, unitLabel, unit, t])

  return (
    <section
      className={cn(
        '@container/card flex h-full min-h-0 flex-col gap-4',
        className
      )}
    >
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='text-[15px] font-semibold tracking-tight'>
            {t('chart.title')}
          </h3>
          <p className='mt-1 text-[12px] text-text-muted'>
            {weekDeltaLabel ?? (
              <>
                <span className='hidden @[540px]/card:inline'>
                  {t('chart.descDesktop', { unit: unitLabel })}
                </span>
                <span className='@[540px]/card:hidden'>
                  {t('chart.descMobile')}
                </span>
              </>
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <SegmentedControl
            aria-label={t('chart.timeRangeAria')}
            value={timeRange}
            onChange={setTimeRange}
            items={[
              { value: '90d', label: t('chart.range90d') },
              { value: '30d', label: t('chart.range30d') },
              { value: '7d', label: t('chart.range7d') },
            ]}
          />
          <SegmentedControl
            aria-label={t('chart.unitAria')}
            value={String(unit)}
            onChange={(v) => onUnitChange(Number(v) as HomeUsedBytesUnit)}
            items={[
              { value: '1', label: 'KB' },
              { value: '2', label: 'MB' },
              { value: '3', label: 'GB' },
            ]}
          />
        </div>
      </header>
      <div className='flex min-h-0 flex-1 flex-col'>
        {isLoading ? (
          <Skeleton className='min-h-[200px] w-full flex-1 rounded-[10px]' />
        ) : isError ? (
          <div className='flex min-h-[200px] flex-1 items-center justify-center text-[13px] text-muted-foreground'>
            {t('chart.loadFailed')}
          </div>
        ) : chartData.length === 0 ? (
          <div className='flex min-h-[200px] flex-1 items-center justify-center text-[13px] text-muted-foreground'>
            {t('chart.noData')}
          </div>
        ) : (
        <ChartContainer
          config={chartConfig}
          /*
            ⚠️ 这里必须给**确定高度**，不能靠 flex-1 + h-full 链。
            踩过的坑：原来是 `flex-1 aspect-auto [&_.recharts-responsive-container]:h-full`，
            容器实测 898x241（尺寸正常），但 recharts 内部的
            ResponsiveContainer 拿到的是 height:100%，而它的父级高度是
            flex 撑出来的**非确定值** → recharts 量到 0 就不渲染 svg，
            而且**不报错**：DOM 里只剩一个空的 .recharts-responsive-container。
            表现就是"折线图完全不显示"，排查时极易误判成数据问题
            （实测 API 200、chartData 有 31 个点）。

            修法：用 min-h + 明确 height 类，让 recharts 有确定的测量基准。
          */
          className='h-[260px] min-h-[220px] w-full text-xs'
        >
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 12 }}
          >
            <defs>
              <linearGradient id='fillUsed' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-used)'
                  stopOpacity={0.16}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-used)'
                  stopOpacity={0.03}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray='3 6' className='stroke-border/60' />
            <YAxis
              domain={[
                0,
                (max: number) => (Number.isFinite(max) && max > 0 ? max * 1.12 : 1),
              ]}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={Y_AXIS_WIDTH[unit]}
              tickFormatter={(v) =>
                typeof v === 'number'
                  ? formatHomeStorageNumber(v, unit)
                  : String(v)
              }
            />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString(dateLocale, {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const d = new Date(value as string)
                    if (Number.isNaN(d.getTime())) return String(value)
                    return d.toLocaleDateString(dateLocale, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                  formatter={(value) => (
                    <div className='flex w-full items-center justify-between gap-2'>
                      <span className='text-muted-foreground'>
                        {t('chart.areaName')}
                      </span>
                      <span className='font-mono font-medium tabular-nums text-foreground'>
                        {typeof value === 'number'
                          ? formatHomeStorageDisplay(value, unitLabel, unit)
                          : String(value)}
                      </span>
                    </div>
                  )}
                  indicator='dot'
                />
              }
            />
            <Area
              name={t('chart.areaName')}
              dataKey='used'
              type='linear'
              fill='url(#fillUsed)'
              stroke='var(--color-used)'
              strokeWidth={areaStrokeWidth}
            />
          </AreaChart>
        </ChartContainer>
        )}
      </div>
    </section>
  )
}
