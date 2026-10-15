/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/auth-context'
import { usePermission } from '@/hooks/use-permission'
import { useWorkspaceStore, findBySlug } from '@/store/workspace'
import type { PermissionCodeType } from '@/types/permission'
import FileManagerPage from '@/pages/files'
import HomePage from '@/pages/home'
import LoginPage from '@/pages/login'
import InvitePage from '@/pages/invite'
import InvitationsPage from '@/pages/invitations'
import { WorkspaceInvitationDock } from '@/components/workspace-invitation-dock'
import NewWorkspacePage from '@/pages/workspace/new'
import SharePage from '@/pages/share'
import FileCollectionPublicPage from '@/pages/collection'
import TransferPage from '@/pages/transfer'
import WorkspaceBoardPage from '@/pages/board'
import MeetingsPage from '@/pages/meetings'
import ProgressLayout from '@/pages/progress'
import ProgressOverview from '@/pages/progress/overview'
import ProgressMonth from '@/pages/progress/month'
import ProgressMine from '@/pages/progress/mine'
import NotificationsPage from '@/pages/notifications'
import NotFoundPage from '@/pages/not-found'
import MeetingRoomPage from '@/pages/meeting/room'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { SettingsModalProvider, useSettingsModal } from '@/contexts/settings-modal-context'
import { NoPermission } from '@/components/no-permission'

function OpenStorageSettings() {
  const { openSettings } = useSettingsModal()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const { slug } = useParams()
  const allowed = hasPermission('storage:manage')

  useEffect(() => {
    if (!allowed) return
    openSettings('storage')
    navigate(`/w/${slug ?? ''}`, { replace: true })
  }, [allowed, navigate, openSettings, slug])

  if (!allowed) return <NoPermission />
  return null
}

function OpenAiSettings() {
  const navigate = useNavigate()
  const { slug } = useParams()

  useEffect(() => {
    navigate(`/w/${slug ?? ''}`, { replace: true })
  }, [navigate, slug])

  return null
}

function ProtectedRoute({
  children,
  requiredPermission,
}: {
  children: React.ReactNode
  requiredPermission?: PermissionCodeType
}) {
  const { t } = useTranslation('common')
  const { isAuthenticated, isLoading } = useAuth()
  const { hasPermission } = usePermission()

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        {t('loading')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <NoPermission />
  }

  return <>{children}</>
}

/** 仅需登录，不需要工作空间 */
function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')
  const { isAuthenticated, isLoading } = useAuth()
  const { pathname } = useLocation()

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        {t('loading')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  /*
   * 会议室是独立全屏窗口（整页视频舞台），工作空间邀请浮层会压在
   * 视频格子和底部控制条上，属于明显的视觉错位 —— 该路由下不渲染它。
   * 其余路由行为不变。
   */
  const hideInviteDock = pathname.startsWith('/meeting/')

  return (
    <SettingsModalProvider>
      {children}
      {hideInviteDock ? null : <WorkspaceInvitationDock />}
    </SettingsModalProvider>
  )
}

/** 根路径重定向：已登录 → /w/{slug}/，未登录 → /login */
function VotesRedirect() {
  const { slug = '' } = useParams()
  return <Navigate to={`/w/${slug}/`} replace />
}

function RootRedirect() {
  const { t } = useTranslation('common')
  const { isAuthenticated, isLoading, needsWorkspaceSetup } = useAuth()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const lastId = useWorkspaceStore((s) => s.currentWorkspaceId)

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        {t('loading')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  if (needsWorkspaceSetup) {
    return <Navigate to='/workspace/new' replace />
  }

  const target = workspaces.find((w) => w.id === lastId) ?? workspaces[0]
  if (!target) {
    return (
      <div className='flex h-screen flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground'>
        <p>{t('workspaceListError')}</p>
        <p className='text-sm'>{t('refreshOrRelogin')}</p>
      </div>
    )
  }
  return <Navigate to={`/w/${target.slug}/`} replace />
}

/**
 * 工作空间路由守卫：
 * 1. 从 URL 读取 :slug
 * 2. 在 store 中查找对应工作空间
 * 3. 若与当前不同则激活（加载角色权限等）
 * 4. slug 无效则回退到根路径
 */
function WorkspaceGuard() {
  const { t } = useTranslation('common')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, activateWorkspace } = useAuth()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const [activating, setActivating] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !slug) return

    const workspace = findBySlug(slug)
    if (!workspace) {
      setReady(true)
      return
    }

    const { currentWorkspaceId, currentRole } =
      useWorkspaceStore.getState()
    const needsActivation =
      workspace.id !== currentWorkspaceId || !currentRole

    if (!needsActivation) {
      setError(null)
      setReady(true)
      return
    }

    if (!activating) {
      setActivating(true)
      setError(null)
      activateWorkspace(workspace.id)
        .then(() => {
          setReady(true)
        })
        .catch(() => {
          setError(t('workspaceLoadError'))
        })
        .finally(() => setActivating(false))
    }
  }, [slug, isLoading, isAuthenticated, workspaces, t])

  if (isLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        {t('loading')}
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  if (!slug || !findBySlug(slug)) {
    return <Navigate to='/' replace />
  }

  if (error) {
    return (
      <div className='flex h-screen flex-col items-center justify-center gap-4'>
        <p className='text-destructive'>{error}</p>
        <div className='flex gap-2'>
          <button
            className='rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90'
            onClick={() => {
              setError(null)
              setReady(false)
              setActivating(false)
            }}
          >
            {t('retry')}
          </button>
          <button
            className='rounded-md border px-4 py-2 text-sm hover:bg-muted'
            onClick={() => navigate('/')}
          >
            {t('backHome')}
          </button>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className='flex h-screen items-center justify-center'>
        {t('loading')}
      </div>
    )
  }

  return (
    <AppLayout>
      <Outlet key={slug} />
    </AppLayout>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/invite',
    element: <InvitePage />,
  },
  {
    path: '/s/:shareToken',
    element: <SharePage />,
  },
  {
    path: '/collect/:collectionId',
    element: <FileCollectionPublicPage />,
  },
  {
    path: '/workspace/new',
    element: (
      <AuthOnlyRoute>
        <NewWorkspacePage />
      </AuthOnlyRoute>
    ),
  },
  {
    path: '/invitations',
    element: (
      <AuthOnlyRoute>
        <InvitationsPage />
      </AuthOnlyRoute>
    ),
  },
  {
    path: '/meeting/:meetingId',
    element: (
      <AuthOnlyRoute>
        <MeetingRoomPage />
      </AuthOnlyRoute>
    ),
  },
  {
    path: '/w/:slug',
    element: (
      <ProtectedRoute>
        <WorkspaceGuard />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'files',
        element: <FileManagerPage />,
      },
      {
        path: 'storage',
        element: <OpenStorageSettings />,
      },
      {
        path: 'transfer',
        element: <TransferPage />,
      },
      {
        path: 'board/:memoId?',
        element: <WorkspaceBoardPage />,
      },
      {
        path: 'votes',
        element: <VotesRedirect />,
      },
      {
        path: 'meetings',
        element: <MeetingsPage />,
      },
      {
        path: 'progress',
        element: <ProgressLayout />,
        children: [
          { index: true, element: <ProgressOverview /> },
          { path: 'month', element: <ProgressMonth /> },
          { path: 'mine', element: <ProgressMine /> },
        ],
      },
      {
        path: 'ai',
        element: <OpenAiSettings />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
    ],
  },
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    /**
     * 404 页的显式入口。
     * 注意：这里**只做增量**——`*` 兜底仍然走 RootRedirect（未知路径回首页），
     * 既有跳转行为一字未改。加这条只是为了 404 页面可达、可截图验收。
     */
    path: '/404',
    element: <NotFoundPage />,
  },
  {
    path: '*',
    element: <RootRedirect />,
  },
])
