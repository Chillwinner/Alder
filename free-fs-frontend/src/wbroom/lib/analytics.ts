/**
 * Matomo 初始化 + 通用事件追踪。
 * 追踪走同源 /tj/（nginx 反代到 MATOMO_HOST），避免跨域被拦。
 *
 * 每次调用都动态读 window._paq：matomo.js 异步加载后会替换队列对象，
 * 顶部缓存的旧引用会变成死引用，事件就丢了。
 */

export type PaqCommand = unknown[]

declare global {
  interface Window {
    _paq?: PaqCommand[]
  }
}

const TRACKER_BASE = '/tj/'

function siteId(): string {
  return String(import.meta.env.VITE_MATOMO_SITE_ID || '123').trim()
}

export function initMatomo() {
  if (typeof window === 'undefined') return
  const id = siteId()
  if (!id) return
  if (document.querySelector('script[src="/tj/matomo.js"]')) return

  const paq = (window._paq = window._paq || [])
  // SPA：PV 由 router.afterEach 打，这里不要再 trackPageView，否则首页会记两次。
  paq.push(['enableLinkTracking'])
  paq.push(['setTrackerUrl', `${TRACKER_BASE}matomo.php`])
  paq.push(['setSiteId', id])

  const g = document.createElement('script')
  g.async = true
  g.src = `${TRACKER_BASE}matomo.js`
  const first = document.getElementsByTagName('script')[0]
  if (first?.parentNode) first.parentNode.insertBefore(g, first)
  else document.head.appendChild(g)
}

function _push(args: PaqCommand) {
  ;(window._paq = window._paq || []).push(args)
}

function _getUserInfo(): { id?: string | number; email?: string } | null {
  try {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  } catch {
    return null
  }
}

function _setUserId() {
  const user = _getUserInfo()
  if (user?.id) _push(['setUserId', String(user.id)])
  if (user?.email) _push(['setCustomVariable', 1, 'User Email', user.email, 'visit'])
}

/**
 * MatomoTracker — 通用事件追踪。
 * 本站无登录/支付，Auth/Payment 方法保留接口但不在业务里调用。
 */
export const MatomoTracker = {
  trackEvent(category: string, action: string, name?: string, value?: number) {
    _setUserId()
    const args: PaqCommand = ['trackEvent', category, action]
    if (name !== undefined && name !== null) args.push(String(name))
    if (value !== undefined && value !== null) args.push(Number(value))
    _push(args)
  },

  trackPageView(title?: string, url?: string) {
    _setUserId()
    if (url) _push(['setCustomUrl', url])
    if (title) _push(['setDocumentTitle', title])
    _push(['trackPageView'])
  },

  trackLogin(method?: string) {
    _setUserId()
    _push(['trackEvent', 'Auth', 'Login', method || 'password'])
  },
  trackLoginFail(method?: string) {
    _push(['trackEvent', 'Auth', 'LoginFail', method || 'password'])
  },
  trackRegister() {
    _setUserId()
    _push(['trackEvent', 'Auth', 'Register', 'email'])
  },
  trackRegisterFail(error?: string) {
    _push(['trackEvent', 'Auth', 'RegisterFail', error || ''])
  },
  trackLogout() {
    _push(['trackEvent', 'Auth', 'Logout'])
    _push(['resetUserId'])
  },
}
