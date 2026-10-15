/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { WindowTrafficLights } from '@/components/window-traffic-lights'

export const dialogExpandedClass =
  '!top-0 !left-0 !h-[100dvh] !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none sm:!max-w-none'

/** 避开右上角窗口控制按钮，标题右侧留白 */
export const dialogChromeTitlePadClass = 'pe-20'

type DialogWindowChromeProps = {
  onClose: () => void
  expanded: boolean
  onToggleExpand: () => void
}

export function DialogWindowChrome({
  onClose,
  expanded,
  onToggleExpand,
}: DialogWindowChromeProps) {
  return (
    <div className='absolute end-3 top-3 z-20'>
      <WindowTrafficLights
        onClose={onClose}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  )
}
