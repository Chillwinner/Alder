/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { type ChangeEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Plus, Search } from 'lucide-react'
import { getUserStorageSettings } from '@/api/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RequirePermission } from '@/components/require-permission'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { AddStorageModal } from './components/AddStorageModal'
import { StorageSettingCard } from './components/StorageSettingCard'
import './storage.css'

export default function StoragePage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('storage')
  const { t: tc } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const [searchTerm, setSearchTerm] = useState('')
  const [addModalVisible, setAddModalVisible] = useState(false)

  const {
    data: userSettings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['userStorageSettings', slug],
    queryFn: getUserStorageSettings,
    staleTime: 30_000,
  })

  // 过滤和排序配置
  const filteredSettings = userSettings
    .slice()
    .sort((a, b) =>
      a.storagePlatform.name.localeCompare(b.storagePlatform.name)
    )
    .filter((s) => {
      if (!searchTerm) return true
      const keyword = searchTerm.toLowerCase()
      return (
        s.storagePlatform.name.toLowerCase().includes(keyword) ||
        s.storagePlatform.identifier.toLowerCase().includes(keyword) ||
        (s.remark || '').toLowerCase().includes(keyword)
      )
    })

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // hero 卡的数据：启用数 / 平台数 / 环形占比（全部由现有列表推导，不引入新接口）
  const enabledCount = userSettings.filter((s) => s.enabled === 1).length
  const totalCount = userSettings.length
  const enabledPct = totalCount ? Math.round((enabledCount / totalCount) * 100) : 0
  const platformsCount = new Set(userSettings.map((s) => s.storagePlatform.identifier)).size
  const RING_R = 34
  const RING_C = 2 * Math.PI * RING_R
  const ringOffset = RING_C * (1 - enabledPct / 100)

  return (
    <div className={embedded ? 'flex flex-col' : 'flex h-full flex-col'}>
      <div
        className={
          embedded
            ? 'flex flex-wrap items-start justify-between gap-4'
            : 'flex items-center gap-4 px-8 pt-7 pb-4'
        }
      >
        {embedded ? null : <SidebarTrigger className='md:hidden' />}

        <div className='min-w-0 flex-1'>
          <p className='a-eyebrow'>存储配置</p>
          <h2 className='mt-1.5 text-[26px] font-semibold tracking-[-0.03em]'>
            {t('page.title')}
          </h2>
          <p className='mt-1 font-mono text-xs tabular-nums text-text-muted'>
            {tc('listTotalItems', { count: filteredSettings.length })}
          </p>
        </div>

        <div className='flex items-center gap-1.5'>
          <div className='relative'>
            <Search
              className='absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-muted'
              strokeWidth={1.75}
            />
            <Input
              placeholder={t('page.searchPlaceholder')}
              className='a-input set-input-sm set-input-leading w-[240px]'
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='size-8 rounded-full text-text-muted'
            onClick={() => refetch()}
          >
            <RefreshCw className='size-3.5' strokeWidth={1.75} />
          </Button>
          <RequirePermission code='storage:manage'>
            <Button
              size='sm'
              className='a-btn a-btn--primary a-btn--sm'
              onClick={() => setAddModalVisible(true)}
            >
              <Plus className='size-3.5' strokeWidth={1.75} />
              {t('page.add')}
            </Button>
          </RequirePermission>
        </div>
      </div>

      <div className={embedded ? 'mt-6' : 'flex-1 overflow-auto px-8 pb-8'}>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <p className='text-text-muted'>{tc('loading')}</p>
          </div>
        ) : userSettings.length === 0 ? (
          <div className='flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-surface/40'>
            <p className='mb-4 text-[13.5px] text-text-secondary'>{t('page.empty')}</p>
            <RequirePermission code='storage:manage'>
              <Button
                className='a-btn a-btn--primary'
                onClick={() => setAddModalVisible(true)}
              >
                <Plus className='size-4' />
                {t('page.addFirst')}
              </Button>
            </RequirePermission>
          </div>
        ) : (
          <div className='mx-auto flex w-full max-w-[1400px] flex-col gap-[18px]'>
            {/* hero 卡：大数值 + 环形占比 + 图例（demo 的存储 hero 版式） */}
            <section className='a-glass rounded-[22px] p-4 sm:p-[18px]'>
              <div className='a-bcell__head'>
                <div className='min-w-0'>
                  <h3 className='truncate'>存储接入</h3>
                  <p className='mt-0.5 truncate text-[12.5px] text-text-secondary'>
                    已接入的外部存储平台与启用状态
                  </p>
                </div>
                <span className='a-tag a-tag--accent shrink-0 font-mono tabular-nums'>
                  {enabledCount} / {totalCount}
                </span>
              </div>

              <div className='a-storage-row'>
                <div className='a-storage-main'>
                  <p className='a-storage-num'>
                    {enabledCount}
                    <small>/ {totalCount} 已启用</small>
                  </p>
                  <p className='mt-2 text-[12.5px] text-text-secondary'>
                    共 {platformsCount} 个平台类型
                  </p>
                </div>

                <svg
                  className='a-ring shrink-0'
                  width='86'
                  height='86'
                  viewBox='0 0 86 86'
                  role='img'
                  aria-label={`启用占比 ${enabledPct}%`}
                >
                  <circle className='a-ring__track' cx='43' cy='43' r={RING_R} />
                  <circle
                    className='a-ring__value'
                    cx='43'
                    cy='43'
                    r={RING_R}
                    strokeDasharray={RING_C}
                    strokeDashoffset={ringOffset}
                  />
                  <text
                    x='43'
                    y='43'
                    textAnchor='middle'
                    dominantBaseline='central'
                    className='a-ring__label'
                  >
                    {enabledPct}%
                  </text>
                </svg>

                <div className='a-legend a-legend--grid'>
                  <div>
                    <i style={{ background: 'var(--primary)' }} />
                    已启用
                    <b>{enabledCount}</b>
                  </div>
                  <div>
                    <i style={{ background: 'var(--surface-3)' }} />
                    已停用
                    <b>{totalCount - enabledCount}</b>
                  </div>
                </div>
              </div>

              <div className='a-hero-foot'>
                <span className='text-[12px] text-text-muted'>
                  停用的配置不会出现在上传目标里
                </span>
              </div>
            </section>

            {/* 配置列表大卡：demo 的卡内三层 */}
            <section className='a-glass rounded-[22px] p-4 sm:p-[18px]'>
              <div className='a-bcell__head'>
                <div className='min-w-0'>
                  <h3 className='truncate'>存储配置</h3>
                  <p className='mt-0.5 truncate text-[12.5px] text-text-secondary'>
                    每一项对应一个可用的上传目标
                  </p>
                </div>
                <span className='a-tag shrink-0 font-mono tabular-nums'>
                  {filteredSettings.length}
                </span>
              </div>

              {filteredSettings.length === 0 ? (
                <div className='flex h-40 items-center justify-center'>
                  <p className='text-[13.5px] text-text-secondary'>{t('page.noMatch')}</p>
                </div>
              ) : (
                <ul className='flex flex-col gap-2.5'>
                  {filteredSettings.map((setting) => (
                    <StorageSettingCard
                      key={setting.id}
                      setting={setting}
                      onRefresh={refetch}
                    />
                  ))}
                </ul>
              )}

              <div className='a-hero-foot'>
                <span className='text-[12px] text-text-muted'>
                  {tc('listTotalItems', { count: filteredSettings.length })}
                </span>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Add Storage Config Modal */}
      <AddStorageModal
        open={addModalVisible}
        onOpenChange={setAddModalVisible}
        onSuccess={refetch}
      />
    </div>
  )
}
