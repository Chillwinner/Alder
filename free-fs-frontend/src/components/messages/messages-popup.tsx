/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Maximize2, Minimize2, MessageCircle, PanelRight, Users, UsersRound, X } from 'lucide-react'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { dialogExpandedClass } from '@/components/dialog-window-chrome'
import { MessagesPopupBody } from '@/components/messages/messages-popup-body'
import { MessagesPopupResizeHandles } from '@/components/messages/messages-popup-resize-handles'
import { createCenteredRect, useFloatingPanel, type PanelRect } from '@/hooks/use-floating-panel'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useImStore } from '@/store/im'

const IM_POPUP_RECT_KEY = 'im-popup-window-rect-v4'

function createMessagesPopupRect(): PanelRect {
  const w = Math.min(880, Math.max(360, window.innerWidth - 32))
  const h = Math.min(640, Math.max(280, Math.round(window.innerHeight * 0.82)))
  return createCenteredRect(w, h)
}

const POPUP_MIN_W = 320
const POPUP_MIN_H = 240

/**
 * 聊天浮窗（气泡态）。
 *
 * 三种形态之一：气泡展开的非模态浮窗。可拖动 / 缩放 / 最大化；
 * 标题栏的「停靠」按钮把它升级为右侧常驻面板；会话头像可拖出成独立小窗。
 */
export function MessagesPopup() {
  const { t } = useTranslation('layout')
  const { t: tm } = useTranslation('messages')
  const open = useImStore((state) => state.dialogOpen)
  const displayMode = useImStore((state) => state.displayMode)
  const panel = useImStore((state) => state.panel)
  const setPanel = useImStore((state) => state.setPanel)
  const openCreateGroup = useImStore((state) => state.openCreateGroup)
  const closeDialog = useImStore((state) => state.closeDialog)
  const attachToSidebar = useImStore((state) => state.attachToSidebar)
  const chatsRef = useRef<HTMLButtonElement>(null)
  const friendsRef = useRef<HTMLButtonElement>(null)
  const [thumb, setThumb] = useState({ x: 0, w: 0 })
  useLayoutEffect(() => {
    const el = panel === 'contacts' ? friendsRef.current : chatsRef.current
    if (!el) return
    setThumb({ x: el.offsetLeft, w: el.offsetWidth })
  }, [panel])
  const { rect, expanded, bindPanel, startMove, startResize, toggleExpanded } = useFloatingPanel(
    open && displayMode === 'popup',
    createMessagesPopupRect,
    { minW: POPUP_MIN_W, minH: POPUP_MIN_H, persistKey: IM_POPUP_RECT_KEY }
  )

  if (displayMode !== 'popup') {
    return null
  }

  return (
    <Dialog open={open} modal={false} onOpenChange={(next) => !next && closeDialog()}>
      <DialogPortal>
        {/*
          无全屏遮罩、非模态：聊天是独立浮窗，点别处不会消失 ——
          工作空间 / 聊天 / 备忘录要能互相拖文件，一旦加遮罩第二次点击就把聊天关了。
          关闭只走标题栏 X。
        */}
        <DialogPrimitive.Content
          ref={bindPanel}
          forceMount
          data-slot='dialog-content'
          className={cn(
            'im-pod im-pod--ios fixed z-50 flex flex-col overflow-hidden outline-none',
            expanded && dialogExpandedClass,
            !open && 'pointer-events-none invisible'
          )}
          style={
            expanded
              ? undefined
              : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
          }
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className='sr-only'>{t('header.messages')}</DialogPrimitive.Title>
          <DialogPrimitive.Description className='sr-only'>
            {t('header.messages')}
          </DialogPrimitive.Description>

          {/* 标题栏：整条可拖拽；右侧按钮不参与拖拽 */}
          <div className='im-ios-head' onPointerDown={startMove}>
            <div className='im-ios-head__text'>
              <span className='im-ios-head__title'>{t('header.messages')}</span>
            </div>
            <div className='im-ios-seg'>
              <div className='im-ios-seg__switch'>
                <span
                  className='im-ios-seg__thumb'
                  style={{ width: thumb.w, transform: `translate(${thumb.x}px, -50%)` }}
                  aria-hidden
                />
                <button
                  ref={chatsRef}
                  type='button'
                  data-on={panel === 'chats' || undefined}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPanel('chats')}
                >
                  <MessageCircle />
                  {tm('inbox.title')}
                </button>
                <button
                  ref={friendsRef}
                  type='button'
                  data-on={panel === 'contacts' || undefined}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPanel('contacts')}
                >
                  <Users />
                  {tm('friends.title')}
                </button>
              </div>
              <button
                type='button'
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => openCreateGroup()}
              >
                <UsersRound />
                {tm('group.create')}
              </button>
            </div>
            <div
              className='im-ios-head__actions'
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7 text-muted-foreground hover:text-foreground'
                onClick={() => attachToSidebar()}
                aria-label='停靠到右侧'
                title='停靠到右侧'
              >
                <PanelRight />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7 text-muted-foreground hover:text-foreground'
                onClick={toggleExpanded}
                aria-label={expanded ? '还原窗口' : '最大化'}
                title={expanded ? '还原窗口' : '最大化'}
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7 text-muted-foreground hover:text-foreground'
                onClick={closeDialog}
                aria-label={t('ai.close')}
                title={t('ai.close')}
              >
                <X />
              </Button>
            </div>
          </div>

          <div className='relative min-h-0 flex-1'>
            <MessagesPopupBody />
          </div>
          {!expanded && <MessagesPopupResizeHandles onResize={startResize} reserveBottomPx={0} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
