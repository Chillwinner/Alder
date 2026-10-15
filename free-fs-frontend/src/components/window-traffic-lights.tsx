/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Maximize2, Minimize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type WindowTrafficLightsProps = {
  onClose: () => void
  expanded: boolean
  onToggleExpand: () => void
}

/**
 * 窗口控制：展开/还原 + 关闭。
 * 文件名沿用（9 处引用），外观由 macOS 红绿灯改为 shadcn ghost 图标按钮，
 * 与全站按钮体系一致；位置由调用方决定（弹窗默认在右上角）。
 */
export function WindowTrafficLights({
  onClose,
  expanded,
  onToggleExpand,
}: WindowTrafficLightsProps) {
  const { t } = useTranslation('common')
  const zoomLabel = expanded
    ? t('preview.restoreWindow')
    : t('preview.maximizeWindow')

  return (
    <div className='flex shrink-0 items-center gap-0.5'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7 text-muted-foreground hover:text-foreground'
        aria-label={zoomLabel}
        title={zoomLabel}
        onClick={onToggleExpand}
      >
        {expanded ? <Minimize2 /> : <Maximize2 />}
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7 text-muted-foreground hover:text-foreground'
        aria-label={t('preview.closeWindow')}
        title={t('preview.closeWindow')}
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}
