/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  Archive,
  FileText,
  Film,
  Image as ImageIcon,
  Music2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HomeUsedBytesUnit } from '@/api/home'
import { ChartStorageGrowth } from './components/chart-storage-growth'
import { HomeCalendarCard } from './components/home-calendar-card'
import { RecentFilesStrip } from './components/recent-files-strip'
import { RecentMemosTable } from './components/recent-memos'
import { StorageOverviewCard } from './components/storage-usage-card'
import { WorkspaceHeader } from './components/workspace-header'
import { useHomeCounts } from './components/home-metrics'
import { AnimatedNumber } from '@/components/animated-number'

/** 三联小卡里「快速访问」用的图标（与 QuickAccess 同一套，保持视觉一致） */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  document: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music2,
  other: Archive,
}

/**
 * Bento 空间栅格（参考 demo: apple_spatial_bento.html）。
 *
 * 外层 12 列、gap-8：
 *   左 8 列 = ① 三张小卡（存储/协同/知识库） ② 最近文件大卡 ③ 存储动态大卡
 *   右 4 列 = ④ 工作空间概况 + 备忘录 ⑤ 分类构成
 *
 * 只负责「看起来的」部分：className / Tailwind 类 / 展示性 JSX 结构 / 纯展示内联 style。
 * hooks、state、props 接口、事件、API、权限、i18n key、data-* 一律不动。
 */

/** 页面私有展示样式：只补构图与材质微调，不改 src/styles/*。 */
const HOME_BENTO_STYLE = `
/* ---- 12 列外层栅格：左 8（主）/ 右 4（侧），gap 比默认更疏 ---- */
.hb-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}
.hb-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.hb-col--main,
.hb-col--side { min-width: 0; }
@media (width >= 1024px) {
  .hb-grid { grid-template-columns: repeat(12, 1fr); gap: 32px; }
  .hb-col { gap: 32px; }
  .hb-col--main { grid-column: span 8; }
  .hb-col--side { grid-column: span 4; }
}

/* 三张小卡：强制等高，形成 demo 里 h-44 的硬节奏 */
.hb-trio {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: stretch;
}
@media (width >= 640px) {
  .hb-trio { grid-template-columns: repeat(3, 1fr); }
}
.hb-trio > * { height: 100%; min-height: 200px; }

/* 卡片内部分三层：顶部 label 行 / 中部主数值 / 底部说明行 */
.hb-stat {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  min-height: 0;
  gap: 14px;
}
.hb-stat__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font: 500 12.5px/1.4 var(--font-sans);
  color: var(--text-muted);
  letter-spacing: 0.005em;
}
.hb-stat__value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.hb-stat__num {
  font: 650 30px/1 var(--font-mono);
  letter-spacing: -0.038em;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}
.hb-stat__unit {
  font: 500 12px/1 var(--font-sans);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hb-stat__caption {
  font: 400 12px/1.45 var(--font-sans);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hb-stat__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font: 400 11.5px/1.4 var(--font-sans);
  color: var(--text-muted);
}
/* 进度条：卡片底部的一条细流光 */
.hb-meter {
  height: 6px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
}
.hb-meter > i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary), var(--hud));
  width: 0;
  transition: width 900ms var(--ease-glide), background 240ms ease;
}
.hb-meter > i.warn {
  background: linear-gradient(90deg, #e24b4a, #f07167);
}

/* ============================================================
   存储卡的双环仪表盘
   ------------------------------------------------------------
   ⚠️ 这套类原来**只有类名、没有样式**（.a-gauge / .a-gauge-row 全站搜不到定义）
      → 两个环按默认块级元素竖向堆叠，缩在一个窄栏里，观感很挤。
      用户要求"两个圆圈放同一行"，所以在这里补齐定义。

   布局：两列等宽、居中；小屏两列仍可容纳（环 108px）。
   ============================================================ */
.hb-gauges {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
.hb-gauge-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: center;
}
.hb-gauge-wrap {
  position: relative;
  display: grid;
  place-items: center;
  width: 108px;
  height: 108px;
}
.hb-gauge-wrap svg {
  width: 108px;
  height: 108px;
  display: block;
}
.hb-gauge-center {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.hb-gauge-center > span {
  font: 500 11px/1.3 var(--font-sans);
  color: var(--text-muted);
  text-align: center;
  max-width: 74px;
}
.hb-gauge-num {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  font: 650 17px/1 var(--font-mono);
  letter-spacing: -0.03em;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}
.hb-gauge-num small {
  font: 500 11px/1 var(--font-sans);
  color: var(--text-muted);
}
.hb-gauge-sub {
  font: 400 11.5px/1.35 var(--font-sans);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 右栏控制台：读数一行、图形一行，文件构成另起一块 */
.hb-console {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hb-console__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.hb-console__kicker {
  margin: 0;
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.hb-console__meta {
  font: 500 12px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
.hb-console__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hb-readout {
  display: grid;
  grid-template-columns: 4.5rem 1fr auto;
  align-items: center;
  column-gap: 10px;
  row-gap: 4px;
  min-width: 0;
}
.hb-readout__name {
  font: 500 13px/1 var(--font-sans);
  color: var(--text-secondary);
}
.hb-readout__track {
  height: 6px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--surface-3);
}
.hb-readout__track > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transition: width 700ms var(--ease-glide);
}
.hb-readout__track > i.warn {
  background: #e24b4a;
}
.hb-readout__val {
  min-width: 3rem;
  font: 600 13px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--foreground);
}
.hb-readout__bytes {
  margin: 0;
  text-align: right;
  font: 500 11px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.hb-fileline {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto 64px;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  color: inherit;
  text-decoration: none;
}
.hb-fileline:hover .hb-fileline__name {
  color: var(--foreground);
}
.hb-fileline__swatch {
  width: 8px;
  height: 8px;
  border-radius: 99px;
}
.hb-fileline__name {
  overflow: hidden;
  font: 500 13px/1 var(--font-sans);
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hb-fileline__num {
  font: 600 12px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--foreground);
}
.hb-fileline__track {
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--surface-3);
}
.hb-fileline__track > i {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.hb-console__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--divider);
}
.hb-console__used {
  min-width: 0;
  overflow: hidden;
  font: 500 12px/1.3 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============================================================
   三联小卡里的「快速访问」紧凑网格
   ------------------------------------------------------------
   用户要求：把它换到三联卡位置，并且"缩减内容、卡片大小和旁边两个一致"。
   所以不能复用 QuickAccess（5 行 × 56px 的竖列表，会撑破 h≈200px 的卡）。
   这里用 2 列网格 + 单行条目（图标 + 名称 + 数量），5 项排 3 行。
   ============================================================ */
.hb-cat {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.hb-cat__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--foreground) 5%, transparent);
  font: 500 12px/1 var(--font-sans);
  color: var(--text-primary);
  transition:
    background-color var(--motion-normal) var(--ease-ios),
    transform var(--motion-normal) var(--ease-spring);
}
.hb-cat__item:hover {
  background: color-mix(in oklab, var(--foreground) 10%, transparent);
  transform: translateY(-1px);
}
.hb-cat__item:active {
  transform: scale(0.98);
}
/* 0 项：置灰且不可点 —— 避免"点了没反应"的错觉 */
.hb-cat__item--empty {
  opacity: 0.45;
  pointer-events: none;
  background: color-mix(in oklab, var(--foreground) 3%, transparent);
}
.hb-cat__name {
  flex: 1;
  min-width: 0;
  color: var(--text-secondary);
}
.hb-cat__num {
  flex: none;
  font: 600 12px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* ============================================================
   「待办」小卡（三联卡第三格）
   ------------------------------------------------------------
   版式与同排的另两张卡一致：label 行 / 中部数字 / 底部说明。
   中间两行是可点入口（会议 / 投票），0 项时置灰不可点。
   ============================================================ */
.hb-todo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hb-todo__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border-radius: 9px;
  background: color-mix(in oklab, var(--foreground) 5%, transparent);
  text-align: left;
  transition:
    background-color var(--motion-normal) var(--ease-ios),
    transform var(--motion-normal) var(--ease-spring);
}
.hb-todo__row:hover:not(:disabled) {
  background: color-mix(in oklab, var(--foreground) 10%, transparent);
  transform: translateY(-1px);
}
.hb-todo__row:active:not(:disabled) {
  transform: scale(0.98);
}
.hb-todo__row:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.hb-todo__ico {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 7px;
}
.hb-todo__ico--meeting {
  background: color-mix(in oklab, var(--primary) 15%, transparent);
  color: var(--primary);
}
.hb-todo__ico--vote {
  background: color-mix(in oklab, var(--warning) 15%, transparent);
  color: var(--warning);
}
.hb-todo__name {
  flex: 1;
  min-width: 0;
  font: 500 12px/1 var(--font-sans);
  color: var(--text-secondary);
}
.hb-todo__num {
  flex: none;
  font: 600 13px/1 var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

/* 大卡内部的分区（标题区与内容区之间一条分隔线） */
.hb-sect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 16px;
}
.hb-sect__title {
  font: 600 16px/1.3 var(--font-sans);
  letter-spacing: -0.022em;
  color: var(--foreground);
}
.hb-sect__desc {
  font: 400 12px/1.45 var(--font-sans);
  color: var(--text-muted);
  margin-top: 3px;
}

/* 参数说明列表：label + font-mono 值，逐行 border-b */
.hb-spec { display: flex; flex-direction: column; }
.hb-spec__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--divider);
  font: 400 12px/1.4 var(--font-sans);
  color: var(--text-muted);
}
.hb-spec__row:last-child { border-bottom: 0; padding-bottom: 0; }
.hb-spec__row b {
  font: 500 12px/1.4 var(--font-mono);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* 分类构成的迷你条形图 */
.hb-dist { display: flex; flex-direction: column; gap: 11px; }
.hb-dist__row {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  align-items: center;
  gap: 10px;
  font: 400 12px/1.4 var(--font-sans);
  color: var(--text-secondary);
}
.hb-dist__track {
  height: 8px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
}
.hb-dist__track > i {
  display: block;
  height: 100%;
  border-radius: 99px;
  width: 0;
  transition: width 900ms var(--ease-glide);
}
.hb-dist__num {
  font: 600 12.5px/1 var(--font-mono);
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
}

/* 右栏说明卡：内层浅底，不喧宾夺主 */
.hb-inset {
  border-radius: var(--radius-md);
  border: 1px solid var(--divider);
  background: var(--surface-secondary);
  padding: 14px;
}

.hb-memo-scope-list {
  animation: hbMemoScopeIn 280ms var(--ease-ios);
}
@keyframes hbMemoScopeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .hb-meter > i,
  .hb-dist__track > i { transition: none; }
  .hb-memo-scope-list { animation: none; }
}
`

function formatLocalQuota(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 2)} GB`
  return `${Math.max(0.01, bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : 2)} MB`
}

/** 三张小卡之一：顶部 label 行 / 中部大数值 + 小单位 / 底部说明行。 */
function StatCell({
  label,
  value,
  unit,
  caption,
  footLeft,
  footRight,
  status,
  children,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  caption?: string
  footLeft?: React.ReactNode
  footRight?: React.ReactNode
  /** 顶部右侧的状态点色，纯展示 */
  status?: string
  children?: React.ReactNode
}) {
  return (
    <div className='hb-stat'>
      <div className='hb-stat__label'>
        <span>{label}</span>
        {status ? (
          <span
            className='a-state-dot a-state-dot--on'
            style={{ background: status, boxShadow: `0 0 8px ${status}` }}
          />
        ) : null}
      </div>

      <div className='min-w-0'>
        <div className='hb-stat__value'>
          <span className='hb-stat__num'>{value}</span>
          {unit ? <span className='hb-stat__unit'>{unit}</span> : null}
        </div>
        {caption ? <div className='hb-stat__caption mt-2'>{caption}</div> : null}
        {children}
      </div>

      <div className='hb-stat__foot'>
        <span className='truncate'>{footLeft}</span>
        {footRight ? <span className='shrink-0'>{footRight}</span> : null}
      </div>
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation('home')
  const { slug = '' } = useParams<{ slug: string }>()
  const [homeStorageUnit, setHomeStorageUnit] =
    React.useState<HomeUsedBytesUnit>(2)

  // 只读展示数据；查询本身仍是既有 hook/API，不新增请求。
  const counts = useHomeCounts()

  return (
    <div className='a-page'>
      <style>{HOME_BENTO_STYLE}</style>

      <WorkspaceHeader unit={homeStorageUnit} />

      {/*
        构图顺序即栅格落位，不能随意调换：
          左侧 8 列（lg:col-span-8）= 三小卡 → 最近文件 → 存储动态
          右侧 4 列（lg:col-span-4）= 工作空间概况 / 备忘录 / 分类构成
        主面板保留 glass-card + data-tilt（PageMotion 入场动画依赖）。
      */}
      <div className='hb-grid'>
        {/* ================= 左 8 列 ================= */}
        <div className='hb-col hb-col--main'>
          {/* ① 三张等高小卡：存储容量 / 空间协同成员 / 知识库 */}
          <div className='hb-trio'>
            <section
              data-tilt
              className='a-bcell glass-card p-6'
              aria-label={t('storageCard.title')}
            >
              <StatCell
                label={t('storageCard.title')}
                value={
                  <span className='font-mono tabular-nums'>
                    {counts.quotaUnavailable
                      ? t('storageCard.unavailable')
                      : counts.localQuotaBytes && counts.localQuotaBytes > 0
                        ? `${Math.min(100, Math.round(((counts.localUsedBytes ?? 0) / counts.localQuotaBytes) * 100))}%`
                        : t('storageCard.unavailable')}
                  </span>
                }
                unit={
                  counts.quotaUnavailable
                    ? t('storageCard.unavailable')
                    : `${formatLocalQuota(counts.localUsedBytes ?? 0)} / ${formatLocalQuota(counts.localQuotaBytes ?? 0)}`
                }
                caption={
                  !counts.quotaUnavailable &&
                  (counts.localQuotaBytes ?? 0) > 0 &&
                  (counts.localUsedBytes ?? 0) / (counts.localQuotaBytes ?? 1) >= 0.75
                    ? t('storageCard.cleanupHint')
                    : undefined
                }
                footLeft={t('recentFiles.title')}
                footRight={
                  <Link
                    to={`/w/${slug}/files`}
                    className='a-tag a-tag--accent transition-colors hover:brightness-110'
                  >
                    {t('category.title')}
                  </Link>
                }
                status={
                  !counts.quotaUnavailable &&
                  (counts.localQuotaBytes ?? 0) > 0 &&
                  (counts.localUsedBytes ?? 0) / (counts.localQuotaBytes ?? 1) >= 0.75
                    ? '#e24b4a'
                    : 'var(--primary)'
                }
              >
                <div className='hb-meter mt-3.5' aria-hidden>
                  <i
                    className={
                      !counts.quotaUnavailable &&
                      (counts.localQuotaBytes ?? 0) > 0 &&
                      (counts.localUsedBytes ?? 0) / (counts.localQuotaBytes ?? 1) >= 0.75
                        ? 'warn'
                        : undefined
                    }
                    style={{
                      width:
                        !counts.quotaUnavailable && (counts.localQuotaBytes ?? 0) > 0
                          ? `${Math.min(100, ((counts.localUsedBytes ?? 0) / (counts.localQuotaBytes ?? 1)) * 100)}%`
                          : '0%',
                    }}
                  />
                </div>
              </StatCell>
            </section>

            {/*
              第二张小卡：快速访问（紧凑版）。
              用户要求："把近 7 天新增的卡片换成快速访问，不过这个快速访问要缩减内容，
              要让卡片大小和旁边两个一致"。

              所以这里**不复用** QuickAccess 组件 —— 那是 5 行 × 56px 的竖列表，
              塞进 h=200px 的三联卡里会撑爆。
              改用紧凑的 2 列网格：每个格子只放「图标 + 名称 + 数量」，
              5 个分类刚好 3 行，高度和三联卡的另外两张齐平。
            */}
            <section
              data-tilt
              className='a-bcell glass-card p-6'
              aria-label={t('category.title')}
            >
              <StatCell
                label={t('category.title')}
                value={
                  <AnimatedNumber value={counts.total} className='font-mono tabular-nums' />
                }
                unit={t('storageCard.filesUnit')}
                footLeft={t('recentFiles.title')}
                footRight={
                  <span className='font-mono tabular-nums'>
                    {counts.distinctTypes}/5
                  </span>
                }
                status='var(--t-image)'
              >
                <div className='hb-cat mt-3.5'>
                  {counts.rows.map((row) => {
                    const Icon = CATEGORY_ICONS[row.type] ?? Archive
                    const empty = row.count === 0
                    return (
                      <Link
                        key={row.type}
                        to={`/w/${slug}/files?type=${row.type}`}
                        aria-disabled={empty}
                        className={cn(
                          'hb-cat__item',
                          empty && 'hb-cat__item--empty'
                        )}
                        title={t(row.titleKey)}
                      >
                        <Icon
                          className='size-3.5 shrink-0'
                          strokeWidth={1.9}
                          style={{ color: empty ? undefined : row.color }}
                        />
                        <span className='hb-cat__name truncate'>
                          {t(row.titleKey)}
                        </span>
                        <span className='hb-cat__num'>{row.count}</span>
                      </Link>
                    )
                  })}
                </div>
              </StatCell>
            </section>

            <HomeCalendarCard />
          </div>

          {/* ② 大卡：最近文件（标题区 + 右侧胶囊按钮，内部横向资产条） */}
          <section data-tilt className='a-bcell glass-card flex flex-col p-8'>
            <div className='hb-sect'>
              <div className='min-w-0'>
                <h2 className='hb-sect__title'>{t('recentFiles.title')}</h2>
                <p className='hb-sect__desc'>
                  {t('category.filesCount', { count: counts.total })}
                </p>
              </div>
              <Link
                to={`/w/${slug}/files`}
                className='a-btn a-btn--secondary a-btn--sm'
              >
                {t('recentFiles.manageLink')}
              </Link>
            </div>
            <RecentFilesStrip unit={homeStorageUnit} />
          </section>

          {/* ③ 大卡：存储动态（整行通栏放最底下） */}
          <section data-tilt className='a-bcell glass-card flex flex-col p-8'>
            <ChartStorageGrowth
              unit={homeStorageUnit}
              onUnitChange={setHomeStorageUnit}
              className='min-h-[300px]'
            />
          </section>
        </div>

        {/* ================= 右 4 列 ================= */}
        <div className='hb-col hb-col--side'>
          {/* ④ 卡：工作空间概况（存储环 + 单卡内边距由内容自管） */}
          <section data-tilt='card' className='a-bcell glass-card p-6'>
            <StorageOverviewCard storageUnit={homeStorageUnit} />
          </section>

          {/*
            ⑤ 卡：备忘录（自带标题与范围切换）
            ⚠️ 这里原来还有第 ⑥ 张「分类快捷入口 + 参数说明」卡，已删除：
               用户要求"把首页右下角的快速访问卡片删了"。
               理由也成立 —— 三联卡里已经有一张**紧凑版快速访问**，
               右下角再来一份 5 行的竖列表是重复内容。
          */}
          <section data-tilt className='a-bcell glass-card p-6'>
            <RecentMemosTable />
          </section>
        </div>
      </div>
    </div>
  )
}
