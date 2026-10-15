/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface TransferSummaryStripProps {
  /** 活跃任务瞬时速度之和（B/s），来自 store 中任务的 speed 字段 */
  totalSpeed: number
  /** 正在传输的任务数（uploading / downloading） */
  activeCount: number
  /** 排队/暂停/处理中的在途任务数 */
  queueCount: number
  /** SSE 连接状态 */
  sseConnected: boolean
}

const splitSpeed = (bytesPerSecond: number) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return { value: '0', unit: 'B/s' }
  }
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytesPerSecond) / Math.log(1024))
  )
  const value = bytesPerSecond / Math.pow(1024, i)
  return {
    value: i === 0 ? String(Math.round(value)) : value.toFixed(1),
    unit: units[i],
  }
}

/**
 * 把总速度采样序列映射为 100x30 视口内的折线点（纯展示，和 demo 的
 * 「总速度」卡一样只做趋势提示）。采样不足 2 个时给一条水平基线。
 */
const buildSparkPoints = (samples: number[]): string => {
  if (samples.length < 2) return '0,24 100,24'
  const max = Math.max(...samples, 1)
  const stepX = 100 / (samples.length - 1)
  return samples
    .map((value, index) => {
      const x = +(index * stepX).toFixed(1)
      const y = +(24 - (value / max) * 18).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')
}

const MAX_SPARK_SAMPLES = 24
/*
 * 统计小卡：等高 h-28、大数值 + 小单位（demo 的数值卡）。
 * 卡内三层：顶部标签行（含右侧小胶囊）/ 中间大数值 / 底部说明行。
 */
const CARD =
  'tf-sum a-glass flex h-28 flex-col justify-between rounded-[20px] p-4'

export default function TransferSummaryStrip({
  totalSpeed,
  activeCount,
  queueCount,
  sseConnected,
}: TransferSummaryStripProps) {
  const { t } = useTranslation('transfer')
  const speed = splitSpeed(totalSpeed)

  // 总速度采样（纯展示层）：只在数值真的变化时追加，供卡片里的趋势折线用
  const [speedSamples, setSpeedSamples] = useState<number[]>([])
  useEffect(() => {
    setSpeedSamples((prev) => {
      const next = prev.length > 0 ? prev.slice() : []
      next.push(totalSpeed)
      while (next.length > MAX_SPARK_SAMPLES) next.shift()
      return next
    })
  }, [totalSpeed])

  return (
    <div className='grid grid-cols-2 gap-3.5 xl:grid-cols-4'>
      {/* 进行中 */}
      <article data-tilt='follow' className={CARD} style={{ animationDelay: '0ms' }}>
        <div className='flex items-center justify-between gap-2'>
          <p className='tf-sum__label'>{t('page.sumActive')}</p>
          <span className='a-tag font-mono tabular-nums'>{t('page.sumQueue', { count: queueCount })}</span>
        </div>
        <p className='flex items-baseline'>
          <span className='tf-sum__value'>{activeCount}</span>
          <span className='tf-sum__unit'>{t('page.sumTasksUnit')}</span>
        </p>
        <div className='tf-sum__foot'>
          <span className='a-state-dot a-state-dot--on' aria-hidden='true' />
          {t('page.sumTransferring')}
        </div>
      </article>

      {/* 总速度 */}
      <article data-tilt='follow' className={CARD} style={{ animationDelay: '50ms' }}>
        <div className='flex items-center justify-between gap-2'>
          <p className='tf-sum__label'>{t('page.sumSpeed')}</p>
          <svg
            className='tf-spark'
            viewBox='0 0 100 30'
            preserveAspectRatio='none'
            aria-hidden='true'
          >
            <polyline points={buildSparkPoints(speedSamples)} />
          </svg>
        </div>
        <p className='flex items-baseline'>
          <span className='tf-sum__value'>{speed.value}</span>
          <span className='tf-sum__unit'>{speed.unit}</span>
        </p>
        <div className='tf-sum__foot'>{t('page.sumSpeedFoot')}</div>
      </article>

      {/* 排队中 */}
      <article data-tilt='follow' className={CARD} style={{ animationDelay: '100ms' }}>
        <div className='flex items-center justify-between gap-2'>
          <p className='tf-sum__label'>{t('page.sumQueued')}</p>
          <span className='a-tag font-mono tabular-nums'>{t('page.sumWait')}</span>
        </div>
        <p className='flex items-baseline'>
          <span className='tf-sum__value'>{queueCount}</span>
          <span className='tf-sum__unit'>{t('page.sumWaitUnit')}</span>
        </p>
        <div className='tf-sum__foot'>{t('page.sumQueuedFoot')}</div>
      </article>

      {/* 实时会话：状态点承担状态语义，不再用大写字距文案 */}
      <article data-tilt='follow' className={CARD} style={{ animationDelay: '150ms' }}>
        <div className='flex items-center justify-between gap-2'>
          <p className='tf-sum__label'>{t('page.sumSession')}</p>
          <span
            className={cn(
              'a-state-dot',
              sseConnected ? 'a-state-dot--on' : 'a-state-dot--off'
            )}
            aria-hidden='true'
          />
        </div>
        <p className='flex items-baseline'>
          <span className='tf-sum__value text-[22px] leading-tight'>
            {sseConnected ? t('page.sumConnected') : t('page.sumDisconnected')}
          </span>
        </p>
        <div className='tf-sum__foot'>
          {sseConnected ? t('page.sumPushOn') : t('page.sumPushOff')}
        </div>
      </article>
    </div>
  )
}
