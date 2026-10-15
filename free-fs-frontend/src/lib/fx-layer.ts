import '@/styles/fx.css'

/**
 * 交互动效层 —— 磁吸按钮 / 卡片 3D 倾斜 / 点击涟漪 / 分段控件滑块。
 * 与业务组件完全解耦：document 级事件委托 + 惰性标记，单页应用全局只注册一次。
 * 明确不含：跟随鼠标的聚光灯（--fx-x/--fx-y / ::after radial / .fx-sheen）、
 * 一闪而过的白光 sweep、toast 反馈（真实项目有 sonner）。
 * 所有查询/回调均空值守卫 + try/catch；prefers-reduced-motion 下不注册磁吸/倾斜/涟漪。
 *
 * 共存说明：项目已有 PressTilt（写 [data-tilt] 的 inline transform）与
 * art-card-pop 入场动画（fill both 钉住 translate 属性）。因此本层：
 * · 倾斜用独立的 translate / rotate 属性（rotate 写 axis-angle），不碰 transform；
 * · 入场动画结束后 fxLock 解除 fill 钉扎，再放开上浮/倾斜；
 * · 磁吸只作用于自身不是 [data-tilt] 的按钮。
 */

let booted = false

export function initFxLayer(): void {
  if (booted) return
  booted = true
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => safe(initAll), { once: true })
    } else {
      initAll()
    }
  } catch {
    /* 光效层任何失败都不得影响主功能 */
  }
}

/* ============================================================
   工具
   ============================================================ */

let REDUCE = false

function safe(fn: () => void): void {
  try {
    fn()
  } catch {
    /* 忽略 */
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

function px(v: number): string {
  return v.toFixed(2) + 'px'
}

/* ============================================================
   选择器常量
   ============================================================ */

/** 磁吸：shadcn Button 根（button）、.btn、显式 [data-fx-mag]；
 *  排除 motion/react 自管 transform 的 AI 光球 / 遮罩 / 新建钮。 */
const MAG_SEL =
  'button:not(.ai-launch):not(.ai-dock-scrim):not(.ai-sheet-plus), .btn, [data-fx-mag]'

/** 涟漪：可点元素（document 委托）。 */
const RIPPLE_SEL =
  "button:not(.ai-dock-scrim), a[href], [role='button'], [role='radio'], [role='tab'], [role='menuitem'], [role='menuitemradio'], [role='switch'], [role='option'], .tree__i"

/** 分段控件（ToggleGroup item）：Radix Toggle 写 data-state=on/off，
 *  shadcn RadioGroup 是 checked/unchecked，天然区分。 */
const SEG_ITEM_SEL =
  "button[role='radio'][data-state='on'], button[role='radio'][data-state='off']"

function initAll(): void {
  try {
    REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    REDUCE = false
  }
  safe(initSeg)
  safe(bindPointer)
}

/* ============================================================
   磁吸按钮（--fx-mx/my ×0.16 鉗 ±4px；hover scale 1.02 / active 0.97）
   ============================================================ */

function magReset(el: Element | null): void {
  if (!el) return
  try {
    const h = el as HTMLElement
    if (h.style.getPropertyValue('--fx-mx')) h.style.removeProperty('--fx-mx')
    if (h.style.getPropertyValue('--fx-my')) h.style.removeProperty('--fx-my')
  } catch {
    /* 忽略 */
  }
}

function magApply(el: HTMLElement, ev: PointerEvent): void {
  try {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    el.style.setProperty('--fx-mx', px(clamp((ev.clientX - cx) * 0.16, -4, 4)))
    el.style.setProperty('--fx-my', px(clamp((ev.clientY - cy) * 0.16, -4, 4)))
  } catch {
    /* 忽略 */
  }
}

function pickMag(t: Element): HTMLElement | null {
  try {
    const el = t.closest(MAG_SEL) as HTMLElement | null
    if (!el) return null
    /* PressTilt 占用 [data-tilt] 的 inline transform 通道 → 跳过 */
    if (el.matches('[data-tilt]')) return null
    if (el.disabled || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') {
      return null
    }
    if (!el.classList.contains('fx-mag')) el.classList.add('fx-mag')
    return el
  } catch {
    return null
  }
}

/* 旧的「卡片 3D 倾斜」代码块已整体删除（perspDone / ensurePerspective / axisAngle /
   lockTilt / finiteRunning / armTilt / tiltApply / tiltReset）。
   按 demo 对齐：卡片不做 3D 旋转，只保留 PressTilt 的平移跟随 + 样式表的悬停抬升与指针微光。 */

/* ============================================================
   指针管线（rAF 节流）：磁吸 + 倾斜
   ============================================================ */

let rafId = 0
let lastEv: PointerEvent | null = null
let curMag: Element | null = null

function process(): void {
  rafId = 0
  const ev = lastEv
  if (!ev) return
  const t = ev.target as Element | null
  if (!t || typeof t.closest !== 'function') return
  if (REDUCE) return

  const mag = pickMag(t)
  if (mag !== curMag) {
    magReset(curMag)
    curMag = mag
  }
  if (mag) magApply(mag, ev)

  /*
    卡片 3D 倾斜管线已停用（按 demo 对齐）。
    跟随鼠标改由 PressTilt 的 transform 通道负责，悬停抬升与指针微光由样式表负责。
    这里保留磁吸按钮部分不动。
  */
}

function onPointerMove(ev: PointerEvent): void {
  lastEv = ev
  if (!rafId) rafId = requestAnimationFrame(process)
}

function resetPointer(): void {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  magReset(curMag)
  curMag = null
}

/* ============================================================
   点击涟漪（pointerdown 从点击点扩散，900ms 清理）
   ============================================================ */

function spawnRipple(host: HTMLElement, clientX: number, clientY: number): void {
  try {
    const r = host.getBoundingClientRect()
    if (!r.width || !r.height) return
    try {
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    } catch {
      /* 忽略 */
    }
    const size = clamp(Math.max(r.width, r.height) * 2.2, 90, 300)
    const sp = document.createElement('span')
    sp.className = 'fx-ripple'
    sp.setAttribute('aria-hidden', 'true')
    sp.style.setProperty('--fx-rs', size + 'px')
    sp.style.setProperty('--fx-rl', clientX - r.left - size / 2 + 'px')
    sp.style.setProperty('--fx-rt', clientY - r.top - size / 2 + 'px')
    host.appendChild(sp)
    const kill = (): void => {
      try {
        if (sp.parentNode) sp.parentNode.removeChild(sp)
      } catch {
        /* 忽略 */
      }
    }
    sp.addEventListener('animationend', (e: Event) => {
      if ((e as AnimationEvent).animationName === 'fx-ripple') kill()
    })
    window.setTimeout(kill, 900)
  } catch {
    /* 忽略 */
  }
}

function onPointerDown(ev: PointerEvent): void {
  if (REDUCE) return
  safe(() => {
    const t = ev.target as Element | null
    if (!t || typeof t.closest !== 'function') return
    const host = t.closest(RIPPLE_SEL) as HTMLElement | null
    if (!host) return
    if (
      host.disabled ||
      host.matches(':disabled') ||
      host.getAttribute('aria-disabled') === 'true'
    ) {
      return
    }
    spawnRipple(host, ev.clientX, ev.clientY)
  })
}

/* ============================================================
   分段控件滑块（.fx-thumb 注入 ToggleGroup 容器）
   ============================================================ */

function placeThumb(seg: HTMLElement, instant: boolean): void {
  try {
    const thumb = seg.querySelector('.fx-thumb') as HTMLElement | null
    if (!thumb) return
    const on = seg.querySelector("[data-state='on']") as HTMLElement | null
    const fallback = seg.querySelector("[role='radio']") as HTMLElement | null
    const target = on || fallback
    if (!target || !target.offsetWidth) return // 隐藏时先不定位
    if (instant) thumb.style.transition = 'none'
    thumb.style.width = target.offsetWidth + 'px'
    thumb.style.transform = 'translateX(' + target.offsetLeft + 'px)'
    if (!thumb.classList.contains('is-ready')) thumb.classList.add('is-ready')
    if (instant) {
      requestAnimationFrame(() => {
        thumb.style.transition = ''
      })
    }
  } catch {
    /* 忽略 */
  }
}

function prepareSeg(item: Element): void {
  try {
    const seg = item.closest('[role="radiogroup"]') as HTMLElement | null
    if (!seg || seg.classList.contains('fx-seg') || seg.classList.contains('no-fx-seg')) return
    let dir = 'row'
    try {
      dir = getComputedStyle(seg).flexDirection || 'row'
    } catch {
      dir = 'row'
    }
    if (dir.indexOf('column') !== -1) return // 纵向分组不放横向滑块
    if (!seg.querySelector(':scope > [role="radio"]')) return
    if (!seg.querySelector(':scope > .fx-thumb')) {
      const th = document.createElement('i')
      th.className = 'fx-thumb'
      th.setAttribute('aria-hidden', 'true')
      seg.insertBefore(th, seg.firstChild)
    }
    seg.classList.add('fx-seg')
    placeThumb(seg, true)
  } catch {
    /* 忽略 */
  }
}

function scanSegs(root: ParentNode): void {
  try {
    root.querySelectorAll(SEG_ITEM_SEL).forEach((item) => prepareSeg(item))
  } catch {
    /* 忽略 */
  }
}

function refreshSegs(): void {
  document.querySelectorAll<HTMLElement>('.fx-seg').forEach((seg) => placeThumb(seg, true))
}

function initSeg(): void {
  scanSegs(document)
  if (typeof MutationObserver !== 'function') return
  try {
    const ob = new MutationObserver((muts) => {
      safe(() => {
        for (const m of muts) {
          if (m.type === 'attributes') {
            const t = m.target
            if (t instanceof Element) {
              const seg = t.closest('[role="radiogroup"]') as HTMLElement | null
              if (seg && seg.classList.contains('fx-seg')) placeThumb(seg, false)
            }
          } else if (m.type === 'childList') {
            m.addedNodes.forEach((n) => {
              if (n instanceof Element) scanSegs(n)
            })
          }
        }
      })
    })
    ob.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })
  } catch {
    /* 忽略 */
  }
}

/* ============================================================
   全局事件（全部委托在 document/window 上，卸载无需清理）
   ============================================================ */

function bindPointer(): void {
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  if (!REDUCE) {
    document.addEventListener('pointerdown', onPointerDown, { passive: true })
  }
  const reset = (): void => safe(resetPointer)
  document.documentElement.addEventListener('mouseleave', reset)
  window.addEventListener('blur', reset)
  let rsT = 0
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(rsT)
      rsT = window.setTimeout(() => {
        safe(() => {
          resetPointer()
          refreshSegs()
        })
      }, 120)
    },
    { passive: true }
  )
}
