/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useRef, useState } from 'react'
import { ImChatPanel } from '@/components/messages/im-chat-panel'
import { ImContactsPanel } from '@/components/messages/im-contacts-panel'
import { ImConversationList } from '@/components/messages/im-conversation-list'
import { cn } from '@/lib/utils'
import { POPUP_LIST_MAX_WIDTH, POPUP_LIST_MIN_WIDTH, useImStore } from '@/store/im'

export function MessagesPopupBody() {
  const panel = useImStore((state) => state.panel)
  const popupListWidth = useImStore((state) => state.popupListWidth)
  const setPopupListWidth = useImStore((state) => state.setPopupListWidth)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      resizeRef.current = { startX: event.clientX, startWidth: popupListWidth }
      setResizing(true)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* capture is optional; pointermove still updates width */
      }
    },
    [popupListWidth]
  )

  const onResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeRef.current) return
      const delta = event.clientX - resizeRef.current.startX
      setPopupListWidth(resizeRef.current.startWidth + delta)
    },
    [setPopupListWidth]
  )

  const endResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = null
    setResizing(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setPopupListWidth(popupListWidth - 16)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setPopupListWidth(popupListWidth + 16)
      } else if (event.key === 'Home') {
        event.preventDefault()
        setPopupListWidth(POPUP_LIST_MIN_WIDTH)
      } else if (event.key === 'End') {
        event.preventDefault()
        setPopupListWidth(POPUP_LIST_MAX_WIDTH)
      }
    },
    [popupListWidth, setPopupListWidth]
  )

  return (
    <div className='flex h-full min-w-0 flex-1 flex-col overflow-hidden'>
      <div key={panel} className={cn('im-pane flex min-h-0 flex-1', panel === 'contacts' && 'is-contacts')}>
        {panel === 'chats' ? (
          <>
            <ImConversationList />
            <div
              role='slider'
              tabIndex={0}
              aria-orientation='vertical'
              aria-valuemin={POPUP_LIST_MIN_WIDTH}
              aria-valuemax={POPUP_LIST_MAX_WIDTH}
              aria-valuenow={popupListWidth}
              aria-label='Resize conversation list'
              className={cn(
                'im-conv-resize relative z-20 w-[3px] shrink-0 cursor-col-resize touch-none',
                'bg-transparent transition-colors duration-150',
                'hover:bg-primary/30 active:bg-primary/45',
                resizing && 'bg-primary/45'
              )}
              onPointerDown={startResize}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onKeyDown={onResizeKeyDown}
            />
            <div className='min-w-0 flex-1'>
              <ImChatPanel variant='popup' />
            </div>
          </>
        ) : (
          <div className='min-w-0 flex-1'>
            <ImContactsPanel />
          </div>
        )}
      </div>
    </div>
  )
}
