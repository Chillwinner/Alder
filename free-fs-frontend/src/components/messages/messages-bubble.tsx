/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimatedNumber } from '@/components/animated-number'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { useImStore } from '@/store/im'

/**
 * 聊天气泡：右下角常驻入口（位于 AI 球正上方）。
 * 聊天窗/面板打开时气泡缩没（浮窗从它的位置长出来）；关闭后弹回。
 * 未读数走角标，有未读时气泡轻轻呼吸。
 */
export function MessagesBubble() {
  const { t } = useTranslation('layout')
  const { isAuthenticated } = useAuth()
  const open = useImStore((state) => state.dialogOpen)
  const unread = useImStore((state) => state.unreadTotal)
  const openDialog = useImStore((state) => state.openDialog)

  if (!isAuthenticated) return null

  return (
    <button
      type='button'
      data-state={open ? 'hidden' : 'shown'}
      className={cn(
        'im-bubble-launcher fixed right-5 bottom-[76px] z-40 grid size-11 place-items-center rounded-full',
        'border border-border bg-card text-foreground shadow-lg',
        'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        unread > 0 && 'im-bubble-launcher--unread'
      )}
      onClick={() => openDialog()}
      aria-label={t('header.messages')}
      title={t('header.messages')}
      tabIndex={open ? -1 : 0}
    >
      <MessageCircle className='size-5' strokeWidth={1.75} />
      {unread > 0 && (
        <span className='absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10.5px] leading-[18px] font-semibold text-destructive-foreground tabular-nums'>
          {unread > 99 ? '99+' : <AnimatedNumber value={unread} duration={400} />}
        </span>
      )}
    </button>
  )
}
