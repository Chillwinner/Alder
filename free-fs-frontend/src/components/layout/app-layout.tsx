/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useMemo } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SearchProvider } from '@/context/search-provider'
import { SettingsModalProvider } from '@/contexts/settings-modal-context'
import { ShortcutsProvider } from '@/hooks/use-shortcut-bindings'
import { ShortcutsHost } from '@/components/shortcuts/shortcuts-host'
import { SettingsDialog } from '@/pages/settings'
import { MessagesPanel } from '@/components/messages/messages-panel'
import { MessagesHost } from '@/components/messages/messages-host'
import { AlderDock } from './alder-dock'
import { Header } from './header'
import { Main } from './main'
import { WorkspaceInvitationDock } from '@/components/workspace-invitation-dock'
import { WorkspaceBoardMetaSseSync } from '@/components/workspace-board-meta-sse-sync'
import { PageMotion } from './page-motion'
import { MemoPreviewHost } from '@/components/memo-preview-host'
import { useDragBodyFlag } from '@/hooks/use-im-external-file-drop'
import { useEdgeWake } from '@/hooks/use-edge-wake'
import { useImStore } from '@/store/im'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

export const LAYOUT_STORAGE_KEY = 'app-layout-v2'

export function getDefaultSidebarOpen(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(LAYOUT_STORAGE_KEY) !== 'compact'
}

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const defaultOpen = useMemo(getDefaultSidebarOpen, [])
  // 全站唯一的拖拽态挂载点：拖拽期间给 <body> 打标记 + 结束时兜底清态
  useDragBodyFlag()

  /*
    边缘唤醒 —— 「工作空间 / 聊天 / 备忘录 无缝切换」的关键一环。
    ------------------------------------------------------------------
    把文件或备忘录**拖到屏幕右侧边缘并停留 ~0.26s**，
    聊天窗自动滑出来，松手即可发送/保存；不用先关当前页再开聊天。

    反向：把**聊天里的文件拖到左侧边缘**，自动跳到工作空间文件页。

    只在真的拖拽时生效，且需要"停留"而不是"划过"，避免误触。
  */
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()

  /*
    用 getState() 而不是 `useImStore((state) => state.openDialog)`：
      · 这里只需要在**拖拽结束的回调里**读一次 action，不需要订阅
      · 也避免引入 `state` 隐式 any 的类型噪音（store/im 的类型推断在本仓
        其他文件里同样报这个错，属于既有问题；这里用 getState 绕开）
  */
  const handleEdgeWake = useCallback(
    (side: 'left' | 'right') => {
      if (side === 'right') {
        // 拖向右侧 → 带出聊天窗
        useImStore.getState().openDialog()
        return
      }
      // 拖向左侧 → 回到工作空间文件页（已经在文件页就不动，避免打断）
      if (slug && !location.pathname.includes('/files')) {
        navigate(`/w/${slug}/files`)
      }
    },
    [navigate, location.pathname, slug]
  )

  useEdgeWake({ onWake: handleEdgeWake })
  return (
    <SettingsModalProvider>
      <SearchProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
      <ShortcutsProvider>
        <ShortcutsHost />
        {/* iOS 26 液态玻璃 Dock：固定悬浮在左侧，内容区给它让位 */}
        <AlderDock />
        <SidebarInset className='min-w-0 md:ps-[124px] md:pe-[18px]'>
          <MessagesHost />
          <Header fixed className='mt-[18px]' />
          <Main fixed fluid className='flex min-h-0 flex-1 flex-col px-5 pt-4 pb-5'>
            <PageMotion>{children}</PageMotion>
          </Main>
        </SidebarInset>
        {/* 聊天：浮窗（MessagesHost）/ 右侧常驻面板 / 独立小窗 */}
        <MessagesPanel />
        {/* 与主侧栏同处 SidebarProvider，设置内外观表单的 useSidebar 才能取到主布局侧边栏 */}
        <SettingsDialog />
        <MemoPreviewHost />
        <WorkspaceInvitationDock />
        <WorkspaceBoardMetaSseSync />
      </ShortcutsProvider>
      </SidebarProvider>
      </SearchProvider>
    </SettingsModalProvider>
  )
}
