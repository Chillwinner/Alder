/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/store/transfer'
import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, Settings, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { SidebarTrigger } from '@/components/ui/sidebar'
import TransferTable from './components/TransferTable'
import TransferSummaryStrip from './components/TransferSummaryStrip'
import TransferSettingModal from './components/TransferSettingModal'

/**
 * 传输页局部样式（只在本页生效，颜色全部走 token）。
 *
 * 页面语言对齐 demo 14-transfer：
 *   概要卡 = iOS 数值卡（中文标签 + mono tabular-nums 数值 + 单位小字）
 *   任务行 = 独立卡片（文件图标 + 中文 chip + mono 元信息 + .a-bar 进度条）
 *   状态点  = .a-state-dot（取代原先的大写字距 HUD 文案）
 *
 * 末尾带 prefers-reduced-motion 兜底。位移一律走 translate（transform 留给入场动画）。
 */
const TRANSFER_CSS = `
.tf-sum {
  position: relative;
  overflow: hidden;
  transition: box-shadow var(--motion-normal) var(--ease-ios);
}
.tf-sum:hover {
  box-shadow: var(--shadow-lg);
}
.tf-sum__label {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--text-secondary);
}
.tf-sum__value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--foreground);
}
.tf-sum__unit {
  margin-left: 5px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
/* 卡片底部说明行：与上方数值用一条分隔线隔开（demo 的卡内三层） */
.tf-sum__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--divider);
  font-size: 11.5px;
  line-height: 1.2;
  color: var(--text-muted);
}
.tf-sum .a-state-dot {
  width: 6px;
  height: 6px;
}
.tf-spark {
  display: block;
  width: 62px;
  height: 22px;
  flex: none;
}
.tf-spark polyline {
  fill: none;
  stroke: var(--primary);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 240;
  stroke-dashoffset: 240;
  animation: tf-spark-draw 1.4s 0.25s var(--ease-glide) forwards;
}
@keyframes tf-spark-draw {
  to { stroke-dashoffset: 0; }
}
.tf-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.tf-chip--run {
  color: var(--primary);
  background: var(--accent-soft);
}
.tf-chip--ok {
  color: var(--success);
  background: color-mix(in oklab, var(--success) 15%, transparent);
}
.tf-chip--err {
  color: var(--destructive);
  background: color-mix(in oklab, var(--destructive) 15%, transparent);
}
.tf-chip--mute {
  color: var(--text-secondary);
  background: var(--surface-secondary);
}
/* 行 = 内层列表项（不再是一行一张独立卡）：圆角浅底 + 行内高亮 */
.tf-row {
  border-radius: var(--radius-md);
  background: var(--surface-secondary);
  border: 1px solid transparent;
  transition:
    background-color var(--motion-normal) var(--ease-glide),
    border-color var(--motion-normal) var(--ease-glide),
    box-shadow var(--motion-normal) var(--ease-ios);
}
.tf-row:hover {
  background: var(--surface-hover);
  border-color: color-mix(in oklab, var(--primary) 26%, var(--divider));
  box-shadow: var(--shadow-sm);
}
/* 暂停中的进度条：降到中性色，和「正在传输」的蓝色区分开 */
.tf-bar--hold > i {
  background: var(--text-muted);
}
.a-btn.tf-danger {
  color: var(--destructive);
}
.a-btn.tf-danger:hover {
  background: color-mix(in oklab, var(--destructive) 12%, transparent);
}
.a-input input[data-slot='input'] {
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 15px;
}
/* 柔和空态：圆形图标底座 + 主文案 + 次级说明（不是白卡居中） */
.tf-empty__orb {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--surface-secondary);
  color: var(--text-muted);
  box-shadow:
    inset 0 0 0 1px var(--divider),
    0 14px 30px -22px color-mix(in oklab, var(--primary) 60%, transparent);
}
.tf-stagger {
  animation: tech-rise var(--motion-panel) var(--ease-ios) backwards;
}
@media (prefers-reduced-motion: reduce) {
  .tf-sum,
  .tf-row {
    transition: none !important;
  }
  .tf-sum:hover,
  .tf-row:hover {
    translate: none !important;
  }
  .tf-spark polyline {
    animation: none !important;
    stroke-dashoffset: 0 !important;
  }
  .tf-stagger {
    animation: none !important;
  }
}
`

export default function TransferPage() {
  const { t } = useTranslation('transfer')
  const { t: tc } = useTranslation('common')
  const [activeTab, setActiveTab] = useState('uploading')
  const [loading, setLoading] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)

  const {
    tasks,
    syncTasks,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    clearCompletedTasks,
    sseConnected,
  } = useTransferStore(
    useShallow((state) => ({
      // 订阅任务 Map，确保上传进度变化时页面实时重新渲染。
      tasks: state.tasks,
      syncTasks: state.syncTasks,
      pauseTask: state.pauseTask,
      resumeTask: state.resumeTask,
      cancelTask: state.cancelTask,
      retryTask: state.retryTask,
      clearCompletedTasks: state.clearCompletedTasks,
      sseConnected: state.sseConnected,
    }))
  )

  const uploadingTasks = Array.from(tasks.values()).filter(
    (task) =>
      task.taskType !== 'download' &&
      [
        'idle',
        'initialized',
        'checking',
        'uploading',
        'paused',
        'merging',
      ].includes(task.status)
  )
  const completedTasks = Array.from(tasks.values()).filter((task) =>
    ['completed', 'failed', 'cancelled'].includes(task.status)
  )

  // 汇总条数据：全部由现有任务列表推导，不引入新接口
  const activeTasks = Array.from(tasks.values()).filter(
    (task) => task.status === 'uploading' || task.status === 'downloading'
  )
  const queueTasks = Array.from(tasks.values()).filter((task) =>
    ['idle', 'initialized', 'checking', 'paused', 'merging'].includes(
      task.status
    )
  )
  const totalSpeed = activeTasks.reduce(
    (sum, task) => sum + (task.speed || 0),
    0
  )

  const currentDisplayTasks =
    activeTab === 'uploading' ? uploadingTasks : completedTasks

  /*
   * iOS 胶囊分段控件：滑块按真实几何测量后位移（和登录页同一套做法）。
   * 只替换「分栏控件的外观」，切换 state 与原有刷新副作用一字未改。
   */
  useEffect(() => {
    const initTransfer = async () => {
      if (sseConnected) {
        const hasCachedTasks = useTransferStore.getState().tasks.size > 0
        // 已有任务时先显示 Zustand 缓存，避免切回页面时出现全屏加载空白。
        setLoading(!hasCachedTasks)
        try {
          await syncTasks()
        } catch (error) {
          console.error('获取传输列表失败:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    initTransfer()
  }, [sseConnected, syncTasks])

  // 监听tab切换，刷新数据
  useEffect(() => {
    if (sseConnected && activeTab === 'completed') {
      const refreshData = async () => {
        const hasCachedTasks = useTransferStore.getState().tasks.size > 0
        // 后台同步时保留当前列表，只有没有任何缓存数据时才显示加载状态。
        setLoading(!hasCachedTasks)
        try {
          await syncTasks()
        } catch (error) {
          console.error('刷新数据失败:', error)
        } finally {
          setLoading(false)
        }
      }
      refreshData()
    }
  }, [activeTab, sseConnected, syncTasks])

  const handleRefresh = async () => {
    try {
      await syncTasks()
    } catch (error) {
      console.error('刷新数据失败:', error)
    }
  }

  const handlePause = async (taskId: string) => {
    try {
      await pauseTask(taskId)
      toast.success(t('page.toastPause'))
    } finally {
      // 无需处理
    }
  }

  const handleResume = async (taskId: string) => {
    try {
      await resumeTask(taskId)
      toast.success(t('page.toastResume'))
    } finally {
      // 无需处理
    }
  }

  const handleCancel = async (taskId: string) => {
    try {
      await cancelTask(taskId)
      toast.success(t('page.toastCancel'))
    } finally {
      // 无需处理
    }
  }

  const handleRetry = async (taskId: string) => {
    try {
      await retryTask(taskId)
      toast.success(t('page.toastRetry'))
    } finally {
      // 无需处理
    }
  }

  const handleClearCompleted = async () => {
    if (completedTasks.length === 0) {
      toast.warning(t('page.toastClearWarn'))
      return
    }

    try {
      await clearCompletedTasks()
      toast.success(t('page.toastClearOk'))
    } finally {
      // 无需处理
    }
  }

  return (
    <div className='a-page'>
      <style href='alder-transfer' precedence='alder-transfer'>
        {TRANSFER_CSS}
      </style>

      {/* 页头：眉标 + 大标题 + 描述；右侧是分栏分段控件与页面级操作 */}
      <header className='a-phead'>
        <div className='min-w-0'>
          <p className='a-eyebrow'>{t('page.eyebrow')}</p>
          <h1 className='truncate'>{t('page.title')}</h1>
          <p className='a-sub'>
            {activeTab === 'uploading'
              ? t('page.inactiveHint')
              : tc('listTotalItems', { count: completedTasks.length })}
          </p>
        </div>

        <div className='a-phead__right'>
          <SidebarTrigger className='md:hidden' />

          {/* 上传中 / 已完成：iOS 胶囊分段（灰轨道 + 白色滑块，不用下划线 tab） */}
          <SegmentedControl
            aria-label={t('page.title')}
            value={activeTab}
            onChange={setActiveTab}
            items={[
              {
                value: 'uploading',
                label: (
                  <>
                    {t('page.tabUploading')}
                    {uploadingTasks.length > 0 ? ` (${uploadingTasks.length})` : ''}
                  </>
                ),
              },
              { value: 'completed', label: t('page.tabCompleted') },
            ]}
          />

          <button
            type='button'
            className='a-btn a-btn--ghost'
            aria-label={t('page.refresh')}
            title={t('page.refresh')}
            onClick={handleRefresh}
          >
            <RefreshCw className='size-4' strokeWidth={1.9} />
          </button>

          <button
            type='button'
            className='a-btn a-btn--ghost'
            aria-label={t('settings.title')}
            onClick={() => setSettingOpen(true)}
          >
            <Settings className='size-4' strokeWidth={1.9} />
            {t('settings.title')}
          </button>

          {activeTab === 'completed' && completedTasks.length > 0 && (
            <button
              type='button'
              className='a-btn a-btn--plain tf-danger'
              onClick={handleClearCompleted}
            >
              <Trash2 className='size-4' strokeWidth={1.9} />
              {t('page.clearAll')}
            </button>
          )}
        </div>
      </header>

      {/* 概要卡：中文标签 + mono 数值（全部由现有任务推导） */}
      <TransferSummaryStrip
        totalSpeed={totalSpeed}
        activeCount={activeTasks.length}
        queueCount={queueTasks.length}
        sseConnected={sseConnected}
      />

      {/* 任务列表大卡：demo 的卡内三层 —— 头部行 / 内层列表 / 底部行 */}
      <section data-tilt='panel' className='a-glass rounded-[22px] p-4 sm:p-[18px]'>
        <div className='a-bcell__head'>
          <div className='min-w-0'>
            <h3 className='truncate'>
              {activeTab === 'uploading' ? t('page.tabUploading') : t('page.tabCompleted')}
            </h3>
            <p className='mt-0.5 truncate text-[12.5px] text-text-secondary'>
              {activeTab === 'uploading'
                ? t('page.emptyUploadingDesc')
                : t('page.emptyCompletedDesc')}
            </p>
          </div>
          <span className='a-tag shrink-0 font-mono tabular-nums'>
            {currentDisplayTasks.length}
          </span>
        </div>

        {loading ? (
          <div className='flex min-h-[260px] items-center justify-center'>
            <p className='text-[13.5px] text-text-secondary'>{tc('loading')}</p>
          </div>
        ) : currentDisplayTasks.length === 0 ? (
          <div className='flex min-h-[260px] items-center justify-center'>
            <Empty className='border-none bg-transparent py-14'>
              <EmptyHeader>
                <EmptyMedia className='tf-empty__orb'>
                  <Upload className='size-7' strokeWidth={1.6} />
                </EmptyMedia>
                <EmptyTitle className='text-[17px] font-semibold tracking-[-0.02em]'>
                  {activeTab === 'uploading'
                    ? t('page.emptyUploadingTitle')
                    : t('page.emptyCompletedTitle')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <TransferTable
            tasks={currentDisplayTasks}
            loading={loading}
            showActions={activeTab === 'uploading'}
            showCompleteTime={activeTab === 'completed'}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        )}

        <div className='mt-3.5 flex items-center justify-between gap-3 border-t border-divider pt-3 text-[12px] text-text-muted'>
          <span className='truncate'>
            {activeTab === 'uploading'
              ? t('page.inactiveHint')
              : tc('listTotalItems', { count: completedTasks.length })}
          </span>
          <span className='shrink-0 font-mono tabular-nums'>
            {activeTab === 'uploading' ? uploadingTasks.length : completedTasks.length}
          </span>
        </div>
      </section>

      <TransferSettingModal open={settingOpen} onOpenChange={setSettingOpen} />
    </div>
  )
}
