/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { aiApi } from '@/api/ai'
import { useAiDockStore } from '@/store/ai-dock'
import { useImStore } from '@/store/im'
import { getCurrentWorkspaceId, useWorkspaceStore } from '@/store/workspace'
import { AiOrbButton } from './ai-orb-button'
import { AiDockPanel } from './ai-dock-panel'
import './ai-dock-fx.css'

/** 浮窗聊天不占右边；侧边栏聊天打开时，AI 整层停在聊天左侧。 */
const AI_DOCK_RIGHT = 20

function useChatSidebarReserve() {
  const docked = useImStore((state) => state.dialogOpen && state.displayMode === 'sidebar')
  const sidebarWidth = useImStore((state) => state.sidebarWidth)
  if (!docked) return 0
  // 窄屏时聊天改成贴右的浮层，宽度写死在 MessagesPanel
  const chatWidth =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches
      ? 336
      : sidebarWidth
  return chatWidth + 28
}

export function AiDockHost() {
  const open = useAiDockStore((s) => s.open)
  const closeDock = useAiDockStore((s) => s.closeDock)
  const toggleDock = useAiDockStore((s) => s.toggleDock)
  const hydrate = useAiDockStore((s) => s.hydrate)
  const { t } = useTranslation('layout')
  const chatReserve = useChatSidebarReserve()
  const right = AI_DOCK_RIGHT
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const settingsQuery = useQuery({
    queryKey: ['workspace-ai-settings', workspaceId],
    queryFn: () => aiApi.getSettings(),
    enabled: Boolean(workspaceId),
  })
  const settings = settingsQuery.data
  const assistantOn = Boolean(
    settingsQuery.isSuccess && settings?.enabled && settings.usingWorkspaceKey
  )

  useEffect(() => {
    if (!open) return
    const workspaceId = getCurrentWorkspaceId()
    if (workspaceId) {
      void hydrate(workspaceId).catch(() => toast.error(t('ai.loadFailed')))
    }
  }, [hydrate, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDock, open])

  useEffect(() => {
    if (!assistantOn) closeDock()
  }, [assistantOn, closeDock])

  if (!assistantOn) return null

  return (
    <LayoutGroup>
      <div
        className='pointer-events-none fixed inset-y-0 left-0 z-[80]'
        style={{ right: chatReserve }}
      >
        <AnimatePresence>
          {open ? (
            <motion.button
              type='button'
              key='scrim'
              aria-label={t('ai.close')}
              className='ai-dock-scrim pointer-events-auto absolute inset-0 border-0'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={closeDock}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence mode='popLayout' initial={false}>
          {open ? (
            <AiDockPanel key='panel' right={right} />
          ) : (
            <AiOrbButton key='orb' onToggle={toggleDock} right={right} />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  )
}
