/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { PictureInPicture2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessagesSidebarBody } from '@/components/messages/messages-sidebar-body'
import { cn } from '@/lib/utils'
import { useImStore } from '@/store/im'

const OVERLAY_QUERY = '(max-width: 1279px)'

export function MessagesPanel() {
  const open = useImStore((state) => state.dialogOpen)
  const displayMode = useImStore((state) => state.displayMode)
  const closeDialog = useImStore((state) => state.closeDialog)
  const detachToPopup = useImStore((state) => state.detachToPopup)
  const sidebarWidth = useImStore((state) => state.sidebarWidth)
  const setSidebarWidth = useImStore((state) => state.setSidebarWidth)
  const [resizing, setResizing] = useState(false)
  const [overlay, setOverlay] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const media = window.matchMedia(OVERLAY_QUERY)
    const sync = () => setOverlay(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const isSidebarMode = displayMode === 'sidebar'
  const showEmbedded = open && isSidebarMode
  const docked = showEmbedded && !overlay

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      resizeRef.current = { startX: event.clientX, startWidth: sidebarWidth }
      setResizing(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [sidebarWidth]
  )

  const onResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeRef.current) return
      const delta = resizeRef.current.startX - event.clientX
      setSidebarWidth(resizeRef.current.startWidth + delta)
    },
    [setSidebarWidth]
  )

  const endResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = null
    setResizing(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <aside
      data-im-messages-panel
      aria-hidden={!showEmbedded}
      data-state={showEmbedded ? 'open' : 'closed'}
      className={cn(
        'im-pod im-pod--panel relative me-3 flex h-[calc(100svh-1.5rem)] shrink-0 flex-col overflow-hidden',
        'self-start',
        docked && 'sticky top-3',
        !docked && 'my-3',
        '[&[data-im-dock-target=true]]:ring-2 [&[data-im-dock-target=true]]:ring-primary/40 [&[data-im-dock-target=true]]:ring-inset',
        resizing && 'im-pod--no-anim',
        !showEmbedded && 'pointer-events-none',
        showEmbedded && 'z-[90]',
        overlay && showEmbedded && 'fixed inset-y-0 right-0 shadow-xl'
      )}
      style={{
        width: docked ? sidebarWidth : overlay && showEmbedded ? 336 : 0,
      }}
    >
      {isSidebarMode && (
        <>
          {docked && (
            <div
              role='separator'
              aria-orientation='vertical'
              aria-label='Resize messages panel'
              className={cn(
                'absolute top-0 left-0 z-20 h-full w-1.5 cursor-col-resize touch-none',
                'hover:bg-primary/15 active:bg-primary/25',
                resizing && 'bg-primary/20'
              )}
              onPointerDown={startResize}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
            />
          )}
          <div
            className={cn(
              'flex h-full min-h-0 flex-col',
              showEmbedded ? '' : 'pointer-events-none invisible'
            )}
            aria-hidden={!showEmbedded}
          >
            <div className='im-ios-head'>
              <div className='im-ios-head__text'>
                <span className='im-ios-head__title'>消息</span>
                <span className='im-ios-head__sub'>消息 · 文件互传</span>
              </div>
              <div className='flex items-center gap-0.5'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 text-muted-foreground hover:text-foreground'
                  onClick={() => detachToPopup()}
                  aria-label='收为浮窗'
                  title='收为浮窗'
                >
                  <PictureInPicture2 />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 text-muted-foreground hover:text-foreground'
                  onClick={closeDialog}
                  aria-label='关闭'
                  title='关闭'
                >
                  <X />
                </Button>
              </div>
            </div>
            <MessagesSidebarBody />
          </div>
        </>
      )}
    </aside>
  )
}
