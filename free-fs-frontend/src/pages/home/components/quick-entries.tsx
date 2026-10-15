/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, NotebookPen, Star, Video } from 'lucide-react'

/**
 * 快捷入口：demo 的 2×2 tinted 按钮网格。
 * 四项都对应项目里真实存在的页面（没有投票页 —— 该路由被重定向到首页）。
 * 文案用字面量：home 命名空间下没有这几个 nav.* 键，用 t() 会渲染出键名。
 */
export function QuickEntries() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const items = [
    { key: 'board', icon: NotebookPen, label: '备忘录', to: `/w/${slug}/board` },
    { key: 'meetings', icon: Video, label: '会议', to: `/w/${slug}/meetings` },
    { key: 'transfer', icon: ArrowLeftRight, label: '传输', to: `/w/${slug}/transfer` },
    { key: 'favorites', icon: Star, label: '收藏', to: `/w/${slug}/files?view=favorites` },
  ]

  return (
    <div className='a-quickgrid'>
      {items.map((it) => {
        const Icon = it.icon
        return (
          <button
            key={it.key}
            type='button'
            className='a-btn a-btn--secondary'
            onClick={() => navigate(it.to)}
          >
            <Icon className='size-[18px]' strokeWidth={1.5} />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
