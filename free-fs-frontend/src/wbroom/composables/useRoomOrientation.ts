import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

/**
 * 手机竖屏进房时提示横屏。
 * 点击「我已横屏」后立刻用 CSS 强制横屏布局，用户再自然转手机。
 */
export function useRoomOrientation() {
  const portrait = ref(false)
  const coarseMobile = ref(false)
  /** 用户已点确认：用强制横屏布局盖住竖屏遮罩 */
  const forcedLandscape = ref(false)
  let mq: MediaQueryList | null = null
  let resizeTimers: number[] = []

  const needsRotate = computed(() => portrait.value && !forcedLandscape.value)
  /** 仍处于物理竖屏、但已强制横屏 UI */
  const forceLandscapeLayout = computed(() => forcedLandscape.value && portrait.value)
  /** 真横屏，或 CSS 强制横屏：统一驱动移动端「横屏布局」样式 */
  const isMobileLandscape = computed(
    () => coarseMobile.value && (forceLandscapeLayout.value || !portrait.value),
  )

  function isCoarseMobile() {
    return (
      window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches ||
      window.matchMedia('(max-width: 900px) and (hover: none)').matches
    )
  }

  function isPortraitNow() {
    if (!isCoarseMobile()) return false
    if (window.matchMedia('(orientation: landscape)').matches) return false
    if (window.matchMedia('(orientation: portrait)').matches) return true
    return window.innerHeight >= window.innerWidth
  }

  function clearResizeTimers() {
    for (const id of resizeTimers) window.clearTimeout(id)
    resizeTimers = []
  }

  function bumpLayout() {
    clearResizeTimers()
    const fire = () => window.dispatchEvent(new Event('resize'))
    fire()
    // 等地址栏 / visualViewport / tldraw 稳定后再刷几轮
    for (const ms of [80, 200, 400]) {
      resizeTimers.push(window.setTimeout(fire, ms))
    }
  }

  function syncHtmlClass() {
    document.documentElement.classList.toggle('room-is-mobile-landscape', isMobileLandscape.value)
    document.documentElement.classList.toggle('room-force-landscape', forceLandscapeLayout.value)
  }

  function update() {
    coarseMobile.value = isCoarseMobile()
    const next = isPortraitNow()
    portrait.value = next
    // 用户已真横屏：去掉 CSS 强制，避免转正后双重旋转
    if (!next && forcedLandscape.value) {
      forcedLandscape.value = false
      void nextTick(bumpLayout)
    }
    syncHtmlClass()
  }

  async function tryLockLandscape() {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (type: string) => Promise<void>
      }
      await orientation?.lock?.('landscape')
    } catch {
      /* iOS 等不支持，依赖 CSS 强制 + 用户转手机 */
    }
  }

  async function confirmLandscape() {
    forcedLandscape.value = true
    syncHtmlClass()
    void tryLockLandscape()
    await nextTick()
    bumpLayout()
  }

  function unlockOrientation() {
    try {
      screen.orientation?.unlock?.()
    } catch {
      /* ignore */
    }
  }

  watch(isMobileLandscape, () => {
    syncHtmlClass()
    bumpLayout()
  })

  onMounted(() => {
    update()
    mq = window.matchMedia('(orientation: portrait)')
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
  })

  onUnmounted(() => {
    clearResizeTimers()
    document.documentElement.classList.remove('room-is-mobile-landscape', 'room-force-landscape')
    mq?.removeEventListener('change', update)
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
    window.visualViewport?.removeEventListener('resize', update)
    unlockOrientation()
  })

  return {
    needsRotate,
    forceLandscapeLayout,
    isMobileLandscape,
    confirmLandscape,
  }
}
