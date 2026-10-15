/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelBottomOpen, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ImChatPanel } from '@/components/messages/im-chat-panel'
import { MessagesPopupResizeHandles } from '@/components/messages/messages-popup-resize-handles'
import { useDetachedChatWindow } from '@/hooks/use-detached-chat-window'
import { cn } from '@/lib/utils'
import { useImStore, type DetachedChatWindow } from '@/store/im'

/** 关闭时舱体 scale+blur 渐隐时长（结束后再真正卸载） */
const CLOSE_EXIT_MS = 400

type ImDetachedChatWindowProps = {
  chat: DetachedChatWindow
}

export function ImDetachedChatWindow({ chat }: ImDetachedChatWindowProps) {
  const { t } = useTranslation('layout')
  const closeDetachedChat = useImStore((state) => state.closeDetachedChat)
  const updateDetachedChatRect = useImStore((state) => state.updateDetachedChatRect)
  const focusDetachedChat = useImStore((state) => state.focusDetachedChat)
  const dockDetachedChat = useImStore((state) => state.dockDetachedChat)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      closeDetachedChat(chat.id)
    }, CLOSE_EXIT_MS)
  }, [chat.id, closeDetachedChat])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    },
    []
  )

  const onRectChange = useCallback(
    (rect: DetachedChatWindow['rect']) => {
      updateDetachedChatRect(chat.id, rect)
    },
    [chat.id, updateDetachedChatRect]
  )

  const onDock = useCallback(() => {
    dockDetachedChat(chat.id)
  }, [chat.id, dockDetachedChat])

  const { startMove, startResize, snapping } = useDetachedChatWindow({
    rect: chat.rect,
    onRectChange,
    onDock,
  })

  return (
    <div
      className={cn(
        'im-pod im-pod--ios im-pod--detached fixed flex flex-col overflow-hidden outline-none',
        closing && 'im-pod--closing',
        !closing && snapping && 'ring-2 ring-primary/40 transition-shadow'
      )}
      style={{
        left: chat.rect.x,
        top: chat.rect.y,
        width: chat.rect.w,
        height: chat.rect.h,
        zIndex: chat.zIndex,
      }}
      onPointerDown={() => focusDetachedChat(chat.id)}
    >
      <div
        className='im-ios-head cursor-move select-none'
        onPointerDown={startMove}
      >
        <div className='im-ios-head__text'>
          <span className='im-ios-head__title'>{t('header.messages')}</span>
        </div>
        <div
          className='flex items-center gap-0.5'
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-7 text-muted-foreground hover:text-foreground'
            onClick={onDock}
            aria-label='收回聊天窗'
            title='收回聊天窗'
          >
            <PanelBottomOpen />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-7 text-muted-foreground hover:text-foreground'
            onClick={requestClose}
            aria-label={t('ai.close')}
            title={t('ai.close')}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className='relative min-h-0 flex-1'>
        <ImChatPanel variant='detached' conversationId={chat.conversationId} active />
        <MessagesPopupResizeHandles onResize={startResize} />
      </div>
    </div>
  )
}
