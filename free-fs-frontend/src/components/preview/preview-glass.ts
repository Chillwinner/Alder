/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'

/** Dimmer only — no page-wide blur */
export const previewOverlayClass = 'bg-app-bg/70 backdrop-blur-none'

/** 与备忘录预览同一套实色壳，聊天里不要半透明透底 */
export const previewWindowClass = cn(
  'glass-overlay border-border text-foreground shadow-2xl'
)

/** 标题栏 / 正文铺在实色壳上，不再单独一层毛玻璃 */
export const previewChromeClass = 'bg-transparent'

/** Inner preview panes (text / office / archive) */
export const previewPaneClass = 'bg-surface-secondary'
