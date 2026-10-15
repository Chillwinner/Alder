/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import axios, {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import i18n, { translateServerText } from '@/i18n'
import { clearAuthSession } from '@/utils/auth'
import { getCurrentWorkspaceId } from '@/store/workspace'

/** 与后端统一包装 `{ code, msg, data }` 一致 */
export interface HttpResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

let isRedirectingToLogin = false

/** 登录页上失败类 401，不应整页踢回（避免密码错误也触发跳转） */
function shouldSkipUnauthorizedRedirect(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/apis/auth/login') ||
    url.includes('/apis/auth/register') ||
    url.includes('/apis/user/register') ||
    url.includes('/apis/file-collections/public/')
  )
}

/** 401：清本地状态并整页跳转登录（带 redirect 便于登录后返回） */
export function redirectToLoginDueToUnauthorized() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true

  clearAuthSession()
  localStorage.removeItem('userInfo')
  sessionStorage.removeItem('userInfo')
  localStorage.removeItem('current-storage-platform')
  localStorage.removeItem('user-storage')
  localStorage.removeItem('workspace-storage')

  import('@/store/workspace').then(({ useWorkspaceStore }) => {
    useWorkspaceStore.getState().clear()
  })
  import('@/store/user').then(({ useUserStore }) => {
    useUserStore.getState().clearUserInfo()
  })

  const path =
    window.location.pathname + window.location.search + window.location.hash
  const loginBase = '/login'
  if (path === loginBase || path.startsWith(`${loginBase}?`)) {
    window.location.href = loginBase
    return
  }
  window.location.href = `${loginBase}?redirect=${encodeURIComponent(path)}`
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers = config.headers || {}
    const headerRecord = config.headers as Record<string, string | undefined>
    const hasWorkspaceHeader =
      headerRecord['X-Workspace-Id'] != null &&
      String(headerRecord['X-Workspace-Id']).length > 0
    if (!hasWorkspaceHeader) {
      const workspaceId = getCurrentWorkspaceId()
      if (workspaceId) {
        headerRecord['X-Workspace-Id'] = workspaceId
      }
    }

    // 如果 URL 中包含了 X-Workspace-Id 参数，也添加到请求头中（用于下载等场景）
    if (config.url?.includes('X-Workspace-Id')) {
      try {
        const url = new URL(config.url, config.baseURL)
        const urlWorkspaceId = url.searchParams.get('X-Workspace-Id')
        if (urlWorkspaceId) {
          config.headers = config.headers || {}
          config.headers['X-Workspace-Id'] = urlWorkspaceId
          // 从 URL 中移除该参数，避免重复
          url.searchParams.delete('X-Workspace-Id')
          config.url = url.toString().replace(url.origin, '')
        }
      } catch {
        // URL 解析失败，忽略
      }
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  (response: AxiosResponse<HttpResponse>) => {
    const { data: res, config } = response

    if (config.responseType === 'blob' || response.status === 204) {
      return response
    }

    if (res.code === 200) {
      return response
    }

    const showError = (config as any).showErrorMessage !== false

    const toastText = translateServerText(
      res.msg,
      i18n.t('common:api.operationFailed')
    )

    if (res.code === 401) {
      if (!shouldSkipUnauthorizedRedirect(response.config?.url)) {
        redirectToLoginDueToUnauthorized()
      } else if (showError) {
        toast.error(
          translateServerText(res.msg, i18n.t('common:api.loginFailed'))
        )
      }
    } else if (res.code === 403) {
      if (showError) {
        toast.error(
          translateServerText(res.msg, i18n.t('common:api.noPermission'))
        )
      }
    } else if (showError) {
      toast.error(toastText)
    }

    const error: any = new Error(toastText)
    error.code = res.code
    error.response = response
    /** 已在上方 toast 或 401 跳转时，避免业务层再弹一层 */
    error.handled =
      res.code === 401 || res.code === 403 || showError
    return Promise.reject(error)
  },
  (error) => {
    const config = error.config || {}
    const showError = (config as any).showErrorMessage !== false

    if (showError && !error.isErrorShown) {
      let errorMessage = i18n.t('common:api.networkFailed')
      let skipToast = false

      if (error.response) {
        const { status, data } = error.response
        const serverMsg =
          data && typeof data === 'object' ? (data as { msg?: string }).msg : undefined
        switch (status) {
          case 400:
            errorMessage = i18n.t('common:api.badRequest')
            break
          case 401:
            if (!shouldSkipUnauthorizedRedirect(error.config?.url)) {
              redirectToLoginDueToUnauthorized()
              skipToast = true
            } else {
              errorMessage = i18n.t('common:api.wrongCredentials')
            }
            break
          case 403:
            errorMessage = i18n.t('common:api.noPermission')
            break
          case 404:
            errorMessage = i18n.t('common:api.notFound')
            break
          case 500:
            errorMessage = i18n.t('common:api.serverError')
            break
          default:
            errorMessage = i18n.t('common:api.requestFailed', { status })
        }
        if (!skipToast && serverMsg) {
          errorMessage = translateServerText(serverMsg, errorMessage)
        }
      } else if (error.message.includes('timeout')) {
        errorMessage = i18n.t('common:api.timeout')
      } else if (error.message.includes('Network Error')) {
        errorMessage = i18n.t('common:api.networkError')
      }

      if (!skipToast) {
        toast.error(errorMessage)
      }
      error.handled = true
    }

    return Promise.reject(error)
  }
)

export const request = {
  get<T = any>(url: string, config?: AxiosRequestConfig) {
    return service
      .get<T, AxiosResponse<HttpResponse<T>>>(url, config)
      .then((response) => response.data.data)
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return service
      .post<T, AxiosResponse<HttpResponse<T>>>(url, data, config)
      .then((response) => response.data.data)
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return service
      .put<T, AxiosResponse<HttpResponse<T>>>(url, data, config)
      .then((response) => response.data.data)
  },

  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return service
      .patch<T, AxiosResponse<HttpResponse<T>>>(url, data, config)
      .then((response) => response.data.data)
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return service
      .delete<T, AxiosResponse<HttpResponse<T>>>(url, config)
      .then((response) => response.data.data)
  },
}

export default service
