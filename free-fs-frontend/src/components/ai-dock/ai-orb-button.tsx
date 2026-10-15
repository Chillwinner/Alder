/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Plus, Sparkles, UsersRound } from 'lucide-react'
import { useAiDockStore } from '@/store/ai-dock'
import { useImStore } from '@/store/im'
import { useWorkspaceStore } from '@/store/workspace'

type AiOrbButtonProps = {
  onToggle: () => void
  right: number
}

/**
 * 右下角「合并悬浮球」（demo .orb）：
 *   左键 = 打开 / 收起空间助手
 *   右键 = 弹出快捷新建菜单（新对话 / 创建群聊 / 打开消息）
 * 两个图标在同一个球里交叉淡入，不做两个按钮。
 * 菜单只是把既有的 store 动作摆到台面上，没有新增任何业务逻辑。
 */
export function AiOrbButton({ onToggle, right }: AiOrbButtonProps) {
  const { t } = useTranslation(['layout', 'messages'])
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const startNewThread = () => {
    setMenuOpen(false)
    const workspaceId = useWorkspaceStore.getState().currentWorkspaceId
    if (!workspaceId) return
    useAiDockStore.getState().openDock()
    void useAiDockStore.getState().createThread(workspaceId)
  }

  const startNewGroup = () => {
    setMenuOpen(false)
    useImStore.getState().openCreateGroup()
  }

  const openMessages = () => {
    setMenuOpen(false)
    useImStore.getState().openDialog()
  }

  return (
    <div ref={rootRef} className='pointer-events-auto absolute bottom-5' style={{ right }}>
      <div
        className='im-ai-menu'
        data-open={menuOpen}
        role='menu'
        aria-label={t('layout:ai.title')}
        aria-hidden={!menuOpen}
      >
        <button
          type='button'
          role='menuitem'
          tabIndex={menuOpen ? 0 : -1}
          className='im-ai-menu__item'
          onClick={startNewThread}
        >
          <Sparkles className='size-4' strokeWidth={1.8} />
          {t('layout:ai.newThread')}
        </button>
        <button
          type='button'
          role='menuitem'
          tabIndex={menuOpen ? 0 : -1}
          className='im-ai-menu__item'
          onClick={startNewGroup}
        >
          <UsersRound className='size-4' strokeWidth={1.8} />
          {t('messages:group.create')}
        </button>
        <button
          type='button'
          role='menuitem'
          tabIndex={menuOpen ? 0 : -1}
          className='im-ai-menu__item'
          onClick={openMessages}
        >
          <MessageCircle className='size-4' strokeWidth={1.8} />
          {t('layout:header.messages')}
        </button>
      </div>

      <motion.button
        type='button'
        aria-expanded={menuOpen}
        aria-haspopup='menu'
        aria-label={t('layout:ai.open')}
        className='ai-launch im-ai-launch relative flex size-[58px] items-center justify-center rounded-full border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring'
        onClick={() => {
          setMenuOpen(false)
          onToggle()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenuOpen((value) => !value)
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <span className='im-ai-orb__ico im-ai-orb__ico--spark' aria-hidden='true'>
          <Sparkles className='size-[22px]' strokeWidth={1.7} />
        </span>
        <span className='im-ai-orb__ico im-ai-orb__ico--plus' aria-hidden='true'>
          <Plus className='size-[23px]' strokeWidth={1.9} />
        </span>
      </motion.button>
    </div>
  )
}
