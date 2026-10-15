import '@/styles/motion.css'
import { useImStore } from '@/store/im'

/* ============================================================
   NEBULA 页面编排动效层 —— 移植自 demo-html/motion.js，适配本项目：
   - 首页 Hero 粒子 canvas（36 颗，上浮 + 摆动 + 闪烁）与旋转描边
   - 路由感知：顶栏面包屑入场重放、Hero 注入 / 回收、聚焦态同步
   - 对话舱聚焦：消息面板开合 → main[data-layout] 轻微缩放压暗
   路由级联入场由 components/layout/page-motion.tsx 负责
   （moCascade keyframes 在 styles/motion.css）。
   所有入口空值守卫 + try/catch；prefers-reduced-motion 全面降级。
   ============================================================ */

/** 首页路由：/ 与 /w/:slug（可带尾斜杠）。 */
const HOME_PATH_RE = /^\/(?:w\/[^/]+)?\/?$/
const PARTICLE_COUNT = 36
const FALLBACK_ACCENT = '#4de3ff'

type Particle = {
  x: number
  y: number
  r: number
  v: number
  sway: number
  sf: number
  af: number
  ph: number
  a: number
}

let inited = false
let reduce = false
let accent = FALLBACK_ACCENT

/* Hero 粒子状态 */
let hero: HTMLElement | null = null
let cv: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let parts: Particle[] = []
let cw = 0
let ch = 0
let pRaf = 0
let lastT = 0
let seedT = 0
let heroObs: ResizeObserver | null = null
let mutObs: MutationObserver | null = null
let mutTimer = 0
let resizeTimer = 0
let syncTimers: number[] = []

/** 页面编排动效层入口（main.tsx 调用一次；重复调用幂等）。 */
export function initMotionLayer(): void {
  if (inited) return
  inited = true
  try {
    boot()
  } catch {
    /* 动效层任何异常都不影响应用本体 */
  }
}

function boot(): void {
  const rmq =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  reduce = Boolean(rmq && rmq.matches)
  if (rmq) {
    const onRM = (e: MediaQueryListEvent) => {
      reduce = Boolean(e.matches)
      if (reduce) stopParticles()
      ensureParticles()
    }
    try {
      rmq.addEventListener('change', onRM)
    } catch {
      /* 旧浏览器降级：不监听即可 */
    }
  }

  readAccent()
  hookNavigation()
  observeRoot()

  ensureMainFx()
  syncFocus()
  try {
    // 消息面板开合的唯一真源：store 状态变化 → 聚焦态同步
    useImStore.subscribe(syncFocus)
  } catch {
    /* 静默 */
  }
  onNavigate() // 首屏编排（顶栏入场 + Hero 注入重试）

  document.addEventListener('visibilitychange', ensureParticles)
  window.addEventListener('resize', onWindowResize)

  // 主题切换（.dark / data-theme）→ 重读 token 色并重绘
  try {
    new MutationObserver(() => {
      readAccent()
      if (!pRaf) drawParticles(seedT)
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
  } catch {
    /* 静默 */
  }
}

/* ============================================================
   1 · 路由感知：history 打点 + popstate → 顶栏入场 / Hero 同步
   ============================================================ */
function emitNavigation(): void {
  try {
    window.dispatchEvent(new Event('mo:navigation'))
  } catch {
    /* 静默 */
  }
}

function hookNavigation(): void {
  try {
    const push = history.pushState.bind(history)
    const replace = history.replaceState.bind(history)
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      const ret = push(...args)
      emitNavigation()
      return ret
    }) as History['pushState']
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      const ret = replace(...args)
      emitNavigation()
      return ret
    }) as History['replaceState']
  } catch {
    /* 静默：打点失败退化为 MutationObserver 兜底 */
  }
  window.addEventListener('popstate', onNavigate)
  window.addEventListener('mo:navigation', onNavigate)
}

function onNavigate(): void {
  try {
    replayTopbar()
    scheduleSync()
  } catch {
    /* 静默 */
  }
}

/** 路由切换后 React 提交时机不定：多个延时点做幂等同步，兜底重试。 */
function scheduleSync(): void {
  for (const t of syncTimers) window.clearTimeout(t)
  syncTimers = []
  for (const delay of [0, 150, 400, 900]) {
    syncTimers.push(
      window.setTimeout(() => {
        try {
          syncHero()
          ensureMainFx()
          syncFocus()
        } catch {
          /* 静默 */
        }
      }, delay)
    )
  }
}

/** 深度监听 #root：页面重挂载（如 React key 变化重建 Hero 容器）后补注入。 */
function observeRoot(): void {
  try {
    if (mutObs) return
    const target = document.getElementById('root') ?? document.body
    if (!target || typeof MutationObserver === 'undefined') return
    mutObs = new MutationObserver(() => {
      window.clearTimeout(mutTimer)
      mutTimer = window.setTimeout(() => {
        try {
          syncHero()
          ensureMainFx()
          syncFocus()
        } catch {
          /* 静默 */
        }
      }, 250)
    })
    mutObs.observe(target, { childList: true, subtree: true })
  } catch {
    /* 静默 */
  }
}

function isHomePath(): boolean {
  try {
    return HOME_PATH_RE.test(window.location.pathname)
  } catch {
    return false
  }
}

/* ============================================================
   2 · 顶栏入场：对面包屑导航重放 .mo-topbar（remove → reflow → add）
   ============================================================ */
function replayTopbar(): void {
  if (reduce) return
  let applied = false
  const run = () => {
    try {
      const el = document.querySelector<HTMLElement>(
        '.app-header nav[aria-label="breadcrumb"]'
      )
      if (!el) return
      el.classList.remove('mo-topbar')
      void el.offsetWidth // 强制 reflow，保证动画可重放
      el.classList.add('mo-topbar')
      applied = true
    } catch {
      /* 静默 */
    }
  }
  try {
    // 等 React 提交完新路由的面包屑内容再重放；首拍失败时补一拍
    requestAnimationFrame(run)
    window.setTimeout(() => {
      if (!applied) run()
    }, 220)
  } catch {
    run()
  }
}

/* ============================================================
   3 · 首页 Hero：检测首页根容器 → 头部区域 prepend 粒子 canvas，
       并注入 .mo-hero-edge 旋转描边
   ============================================================ */
function syncHero(): void {
  try {
    const view = document.querySelector('.art-page-view')
    const pageRoot = view ? (view.firstElementChild as HTMLElement | null) : null
    const target: HTMLElement | null =
      isHomePath() && pageRoot
        ? (pageRoot.querySelector<HTMLElement>('header') ?? pageRoot)
        : null

    if (target) {
      if (hero !== target) {
        detachHero()
        hero = target
        attachHeroFX(target)
        bindHeroResize()
        sizeCanvas()
        ensureParticles()
      } else {
        attachHeroFX(target) // 防御性补注入（React 重渲染若移除了注入节点）
        ensureParticles()
      }
    } else if (hero) {
      detachHero()
    }
  } catch {
    /* 静默 */
  }
}

function attachHeroFX(root: HTMLElement): void {
  root.classList.add('mo-hero')
  let canvas = root.querySelector<HTMLCanvasElement>(':scope > .mo-particles')
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'mo-particles'
    canvas.setAttribute('aria-hidden', 'true')
    root.insertBefore(canvas, root.firstChild)
  }
  let edge = root.querySelector<HTMLElement>(':scope > .mo-hero-edge')
  if (!edge) {
    edge = document.createElement('span')
    edge.className = 'mo-hero-edge'
    edge.setAttribute('aria-hidden', 'true')
    root.insertBefore(edge, canvas.nextSibling) // 描边层紧随 canvas、在内容之下
  }
  if (cv !== canvas) {
    cv = canvas
    try {
      ctx = canvas.getContext('2d')
    } catch {
      ctx = null
    }
    seedParticles()
    seedT = performance.now()
  }
}

function detachHero(): void {
  stopParticles()
  try {
    if (hero) {
      hero.classList.remove('mo-hero')
      hero.querySelector(':scope > .mo-particles')?.remove()
      hero.querySelector(':scope > .mo-hero-edge')?.remove()
    }
  } catch {
    /* 静默 */
  }
  if (heroObs) {
    try {
      heroObs.disconnect()
    } catch {
      /* 静默 */
    }
    heroObs = null
  }
  hero = null
  cv = null
  ctx = null
  cw = 0
  ch = 0
  parts = []
}

function bindHeroResize(): void {
  try {
    if (heroObs) heroObs.disconnect()
    heroObs = null
    if (!hero || typeof ResizeObserver === 'undefined') return
    heroObs = new ResizeObserver(() => {
      try {
        sizeCanvas()
        if (!pRaf) drawParticles(reduce ? seedT : 0)
      } catch {
        /* 静默 */
      }
    })
    heroObs.observe(hero)
  } catch {
    /* 静默 */
  }
}

function readAccent(): void {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--hud')
      .trim()
    accent = v || FALLBACK_ACCENT
  } catch {
    accent = FALLBACK_ACCENT
  }
}

function sizeCanvas(): void {
  if (!ctx || !cv || !hero) return
  const w = hero.clientWidth
  const h = hero.clientHeight
  if (!w || !h) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2) // DPR 上限 2
  cw = w
  ch = h
  cv.width = Math.round(w * dpr)
  cv.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function seedParticles(): void {
  parts = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    parts.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 1.8,
      v: 0.014 + Math.random() * 0.03, // 每秒归一化上升量
      sway: 4 + Math.random() * 14,
      sf: 0.3 + Math.random() * 0.7, // 摆动频率
      af: 0.6 + Math.random() * 1.6, // 闪烁频率
      ph: Math.random() * Math.PI * 2,
      a: 0.25 + Math.random() * 0.55,
    })
  }
}

function drawParticles(t: number): void {
  if (!ctx || !cv || !cw || !ch) return
  try {
    ctx.clearRect(0, 0, cw, ch)
    ctx.fillStyle = accent
    const time = t / 1000
    for (const p of parts) {
      const x = p.x * cw + Math.sin(time * p.sf + p.ph) * p.sway
      const y = p.y * ch
      const tw = 0.55 + 0.45 * Math.sin(time * p.af + p.ph * 1.7)
      const a = Math.max(0, Math.min(1, p.a * tw))
      ctx.globalAlpha = a * 0.22
      ctx.beginPath()
      ctx.arc(x, y, p.r * 3.2, 0, 6.28318)
      ctx.fill()
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(x, y, p.r, 0, 6.28318)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } catch {
    /* 静默 */
  }
}

function heroVisible(): boolean {
  return !!hero && hero.isConnected && hero.offsetParent !== null
}

function stopParticles(): void {
  if (pRaf) cancelAnimationFrame(pRaf)
  pRaf = 0
  lastT = 0
}

function particleLoop(now: number): void {
  pRaf = 0
  if (reduce || document.hidden || !heroVisible()) return // 条件失效即停
  const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0
  lastT = now
  for (const p of parts) {
    p.y -= p.v * dt
    if (p.y < -0.03) {
      p.y = 1.03
      p.x = Math.random()
    }
  }
  drawParticles(now)
  pRaf = requestAnimationFrame(particleLoop)
}

function ensureParticles(): void {
  stopParticles()
}

function onWindowResize(): void {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    try {
      sizeCanvas()
      if (!pRaf) drawParticles(reduce ? seedT : 0)
      ensureParticles()
    } catch {
      /* 静默 */
    }
  }, 120)
}

/* ============================================================
   4 · 对话舱聚焦：消息面板开合（store: dialogOpen / displayMode）
       → main[data-layout] 轻微 scale + 压暗；sidebar 停靠减弱幅度
   ============================================================ */
function ensureMainFx(): void {
  try {
    document.querySelector('main[data-layout]')?.classList.add('mo-main-fx')
  } catch {
    /* 静默 */
  }
}

function syncFocus(): void {
  try {
    ensureMainFx()
    const main = document.querySelector<HTMLElement>('main[data-layout]')
    if (!main) return
    const state = useImStore.getState()
    const open = Boolean(state.dialogOpen)
    const dock = state.displayMode === 'sidebar'
    main.classList.toggle('mo-focus', open)
    main.classList.toggle('mo-focus--dock', open && dock)
  } catch {
    /* 静默 */
  }
}
