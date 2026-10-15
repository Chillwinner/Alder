/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { UserInfo } from '@/types/user'
import { mergeUserInfo } from '@/utils/merge-user-info'
import { workspaceApi } from '@/api/workspace'
import { useWorkspaceStore } from '@/store/workspace'
import {
  setAuthSession,
  clearAuthSession,
  hasAuthSession,
} from '@/utils/auth'

interface AuthContextType {
  isAuthenticated: boolean
  user: UserInfo | null
  needsWorkspaceSetup: boolean
  login: (userInfo: UserInfo, remember?: boolean) => Promise<void>
  logout: () => void
  updateUser: (patch: Partial<UserInfo>) => void
  /** 加载工作空间列表（不激活） */
  loadWorkspaces: () => Promise<boolean>
  /** 激活指定工作空间：设置 ID、加载角色权限、加载存储配置 */
  activateWorkspace: (workspaceId: string) => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsWorkspaceSetup, setNeedsWorkspaceSetup] = useState(false)

  const wsStore = useWorkspaceStore

  const loadStoragePlatform = async () => {
    localStorage.removeItem('current-storage-platform')
  }

  const loadWorkspaces = useCallback(async (): Promise<boolean> => {
    try {
      const workspaces = await workspaceApi.list()
      wsStore.getState().setWorkspaces(workspaces)

      if (workspaces.length === 0) {
        setNeedsWorkspaceSetup(true)
        return false
      }

      setNeedsWorkspaceSetup(false)
      return true
    } catch (error) {
      console.error('加载工作空间列表失败:', error)
      return false
    }
  }, [])

  const activateWorkspace = useCallback(async (workspaceId: string) => {
    wsStore.getState().setCurrentWorkspaceId(workspaceId)
    localStorage.removeItem('current-storage-platform')

    const detail = await workspaceApi.getCurrent()
    wsStore.getState().setCurrentRole({
      roleCode: detail.roleCode,
      roleName: detail.roleName,
      permissions: detail.permissions,
    })

    await Promise.all([
      loadStoragePlatform(),
      import('@/store/user')
        .then(({ useUserStore }) => useUserStore.getState().loadTransferSetting())
        .catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (hasAuthSession()) {
          const { useUserStore } = await import('@/store/user')
          const userStore = useUserStore.getState()

          let userInfo: UserInfo | null = null

          try {
            const { userApi } = await import('@/api/user')
            userInfo = await userApi.getUserInfo()
            userStore.setUserInfo(userInfo)
          } catch {
            if (userStore.id) {
              userInfo = {
                id: userStore.id,
                username: userStore.username,
                nickname: userStore.nickname,
                email: userStore.email,
                avatar: userStore.avatar,
                status: userStore.status,
                createdAt: userStore.createdAt,
                updatedAt: userStore.updatedAt,
                lastLoginAt: userStore.lastLoginAt,
                isSetPassword: userStore.isSetPassword,
              }
            }
          }

          if (userInfo) {
            setUser(userInfo)
            setIsAuthenticated(true)
            await loadWorkspaces()
          }
        }
      } catch (error) {
        console.error('初始化认证信息失败:', error)
        clearAuthSession()
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [loadWorkspaces])

  const login = useCallback(
    async (userInfo: UserInfo, remember = false) => {
      try {
        setAuthSession(remember)
        setUser(userInfo)
        setIsAuthenticated(true)

        const { useUserStore } = await import('@/store/user')
        const userStore = useUserStore.getState()
        userStore.setUserInfo(userInfo)

        await loadWorkspaces()
      } catch (error) {
        console.error('登录失败:', error)
        throw error
      }
    },
    [loadWorkspaces]
  )

  const logout = useCallback(() => {
    void import('@/api/user').then(({ userApi }) => userApi.logout()).catch(() => {})
    setUser(null)
    setIsAuthenticated(false)
    setNeedsWorkspaceSetup(false)

    clearAuthSession()
    localStorage.removeItem('current-storage-platform')

    import('@/store/user').then(({ useUserStore }) => {
      useUserStore.getState().clearUserInfo()
    })

    wsStore.getState().clear()
    void import('@/store/im-crypto').then(({ useImCryptoStore }) => {
      useImCryptoStore.getState().clearSession()
    })
  }, [])

  const updateUser = useCallback((patch: Partial<UserInfo>) => {
    setUser((prev) => {
      if (!prev) {
        return patch as UserInfo
      }
      const merged = mergeUserInfo(prev, patch)
      import('@/store/user').then(({ useUserStore }) => {
        useUserStore.getState().setUserInfo(merged)
      })
      return merged
    })
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      user,
      needsWorkspaceSetup,
      login,
      logout,
      updateUser,
      loadWorkspaces,
      activateWorkspace,
      isLoading,
    }),
    [
      isAuthenticated,
      user,
      needsWorkspaceSetup,
      login,
      logout,
      updateUser,
      loadWorkspaces,
      activateWorkspace,
      isLoading,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
