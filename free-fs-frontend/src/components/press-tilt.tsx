/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect } from 'react'
import { SPRING, createAxis, isAtRest, retarget, step, type SpringConfig } from '@/lib/spring'

/**
 * 卡片跟随指针 + 弹簧抬升 + 指针微光。
 *
 * ============================================================
 * 与旧版的根本区别：**用物理代替插值**
 * ============================================================
 * 旧实现是 `x += (target - x) * 0.18` 的指数插值：
 *   · 没有"速度"这个概念 → 无法过冲 → 没有回弹
 *   · 改目标时速度被丢弃 → 反向时从 0 速度重启 → 视觉上"一顿"
 *   · 系数是手调的，快慢不可分（想更跟手就会更抖）
 *
 * 现在每个自由度跑一个真弹簧（见 lib/spring.ts）：
 *   · 有速度 → 松手自然过冲回弹（lift 预设 ζ≈0.72）
 *   · 中途改目标**保留速度** → 拖到一半反向，动作接得上（这是 iOS 的关键）
 *   · 刚度/阻尼/质量三个物理量独立可调，跟手与稳不再互斥
 *
 * ⚠️ 四条必须守住的纪律（都是踩过的坑）：
 *
 * 1. getBoundingClientRect() 返回**已变换后**的矩形。直接拿它算相对位置，
 *    等于把自己的位移读回输入 → 正反馈 → 抖动。
 *    所以把当前位移从 rect 里扣掉，得到未变换的基准矩形。
 *
 * 2. 收敛后必须真正停掉 rAF，否则每帧重写 transform 会拖垮其它过渡。
 *
 * 3. 一次悬停只服务**最外层**的 [data-tilt]：背景与内容常常分属两层，
 *    取最近一层会出现"背景不动、内容在动"的割裂，且兄弟间穿梭时目标反复切换 → 抖动。
 *
 * 4. 三条通道严格分离，互不覆盖：
 *      transform    → 本模块的弹簧（跟随）
 *      scale        → 按下的弹簧（独立属性，避免和 transform 打架）
 *      translate    → 样式表的悬停抬升（CSS 过渡，含离场回弹）
 *      --gx/--gy    → 指针微光
 */

/**
 * 掠光半径，用于把指针位置换算成高光左上角。
 *
 * ⚠️ 必须与 index.css 里 [data-tilt]::after 的 width/height 同步：
 *    这里是「左上角 = 指针 − 半径」，CSS 那边宽高是**直径 = 2 × 半径**。
 *    GLARE_R = 160 ⇒ CSS 写 320px。两边不同步 → 高光中心偏离指针
 *    （半径每差 1px，中心就偏 1px）。
 *
 * ⚠️ 半径**不能**超过卡片本身（文件卡 179×222）：高光跟着指针在卡片外游走时，
 *    中心会落到卡外 → 越靠边越看不见，和"玻璃反光"的直觉相反。
 *    实测把 CSS 放大到 640px 就是这个症状，所以收在 320px。
 *
 * demo（apple_spatial_bento）的 specular 是 `radial-gradient(600px, …)` 的
 * **柔光**而不是亮点 —— 亮点像手电筒，柔光才像玻璃在反射环境。
 * 柔光的"大范围"靠 CSS 里的多层色标做（0% → 38% → 65% 渐次衰减），
 * 不是靠把半径撑大。
 */
/**
 * 这些容器内部一律不跟随。
 * 弹窗/菜单/气泡里的元素一旦跟着指针动，按钮就会从指针下面跑掉 ——
 * 表现为"疯狂来回震，根本点不到"。
 */
const NO_TILT_ZONE = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[data-radix-popper-content-wrapper]',
  '[data-slot="dialog-content"]',
  '[data-slot="popover-content"]',
  '.no-tilt',
].join(',')

const MIN_W = 140
const MIN_H = 90
/** 过宽/过高的面不跟手（整块飘走观感差）。玻璃已去除，卡片类不再排除。 */
const MAX_FOLLOW_W = 420
const MAX_FOLLOW_H = 260
/** 首页侧栏监控卡等稍大的整卡。 */
const MAX_CARD_W = 560
const MAX_CARD_H = 480
/** 传输列表 / 会议分组等通栏玻璃块。 */
const MAX_PANEL_W = 2000
const MAX_PANEL_H = 900

type Track = {
  el: HTMLElement
  x: ReturnType<typeof createAxis>
  y: ReturnType<typeof createAxis>
  scale: ReturnType<typeof createAxis>
  lift: ReturnType<typeof createAxis>
  cfg: SpringConfig
  pressed: boolean
  baseLeft: number
  baseTop: number
  width: number
  height: number
}

/** 轻轻跟着指针挪几像素。大模块再收一点，避免整块飘走。 */
function followDistance(el: HTMLElement, width: number, height: number) {
  const dense = el.dataset.tilt === 'dense'
  const span = Math.max(width, height, 1)
  const comfort = dense ? 4 : 8
  const floor = dense ? 2.5 : 4
  return Math.max(floor, comfort * Math.min(1, 480 / span))
}

/**
 * 解析本次悬停的唯一目标：从命中元素往上找**最外层**的 [data-tilt]。
 */
function resolveTarget(from: Element): HTMLElement | null {
  let node: Element | null = from
  let outermost: HTMLElement | null = null
  let row: HTMLElement | null = null
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-tilt')) {
      outermost = node
      if (node.dataset.tilt === 'row') row = node
    }
    node = node.parentElement
  }
  const target = row ?? outermost
  if (!target) return null
  if (target.closest(NO_TILT_ZONE)) return null

  const rect = target.getBoundingClientRect()
  const mode = target.dataset.tilt
  if (mode === 'row') {
    if (rect.height < 36 || rect.height > MAX_FOLLOW_H) return null
    if (rect.width < 80) return null
  } else if (mode === 'card') {
    if (rect.width < MIN_W || rect.height < MIN_H) return null
    if (rect.width > MAX_CARD_W || rect.height > MAX_CARD_H) return null
  } else if (mode === 'panel') {
    if (rect.width < MIN_W || rect.height < 80) return null
    if (rect.width > MAX_PANEL_W || rect.height > MAX_PANEL_H) return null
  } else if (mode === 'follow') {
    if (rect.width < 120 || rect.height < 80) return null
    if (rect.width > MAX_FOLLOW_W || rect.height > 200) return null
  } else {
    if (rect.width < MIN_W || rect.height < MIN_H) return null
    if (rect.width > MAX_FOLLOW_W || rect.height > MAX_FOLLOW_H) return null
  }

  return target
}

function paint(track: Track) {
  const { el, x, y, scale, lift } = track
  const s = scale.value
  el.style.transform = `translate3d(${x.value.toFixed(2)}px, ${(y.value + lift.value).toFixed(2)}px, 0) scale(${s.toFixed(4)})`
}

function clear(el: HTMLElement) {
  el.style.transform = ''
  el.style.willChange = ''
}

export function PressTilt() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const tracks = new Map<HTMLElement, Track>()
    let hovered: HTMLElement | null = null
    let raf = 0
    let last = 0
    let pointerX = 0
    let pointerY = 0
    let pointerTarget: EventTarget | null = null

    const applyPointer = () => {
      const el =
        pointerTarget instanceof Element ? resolveTarget(pointerTarget) : null
      if (hovered && hovered !== el) release(hovered)
      hovered = el
      if (!el) return

      /*
       * 入场动画（.tech-rise / .tf-stagger）是样式表 animation。
       * [data-tilt]:hover { animation: none } 只在悬停时压住它；
       * 移出后 :hover 掉、transform 被清掉，tech-rise 会从
       * translateY(10px)/opacity:0 重播 → 闪一下。
       * 跟手一旦接手，就把 animation 钉死，不再让它复活。
       */
      if (el.style.animation !== 'none') {
        el.style.animation = 'none'
        el.style.animationDelay = '0s'
      }

      const track = trackOf(el)
      if (!track.width) {
        const rect = el.getBoundingClientRect()
        track.baseLeft = rect.left - track.x.value
        track.baseTop = rect.top - track.y.value
        track.width = rect.width
        track.height = rect.height
      }

      const px = (pointerX - track.baseLeft) / track.width - 0.5
      const py = (pointerY - track.baseTop) / track.height - 0.5
      const distance = followDistance(el, track.width, track.height)
      retarget(track.x, px * 2 * distance)
      retarget(track.y, py * 2 * distance)
      retarget(track.lift, liftFor(el))
    }

    const tick = (now: number) => {
      raf = 0
      const dt = last ? Math.min((now - last) / 1000, 1 / 60) : 1 / 60
      last = now
      applyPointer()

      let active = false
      for (const [el, track] of tracks) {
        step(track.x, track.cfg, dt)
        step(track.y, track.cfg, dt)
        step(track.scale, SPRING.press, dt)
        step(track.lift, SPRING.lift, dt)

        const rest =
          isAtRest(track.x, track.cfg) &&
          isAtRest(track.y, track.cfg) &&
          isAtRest(track.scale, SPRING.press) &&
          isAtRest(track.lift, SPRING.lift)

        if (rest) {
          const home =
            track.x.target === 0 &&
            track.y.target === 0 &&
            track.scale.target === 1 &&
            track.lift.target === 0
          if (home && !track.pressed) {
            clear(el)
            tracks.delete(el)
            continue
          }
        }

        paint(track)
        active = true
      }

      if (active || hovered) {
        raf = requestAnimationFrame(tick)
      } else {
        last = 0
      }
    }

    const wake = () => {
      if (!raf) {
        last = 0
        raf = requestAnimationFrame(tick)
      }
    }

    const trackOf = (el: HTMLElement): Track => {
      let track = tracks.get(el)
      if (!track) {
        const dense = el.dataset.tilt === 'dense'
        track = {
          el,
          x: createAxis(0, 0),
          y: createAxis(0, 0),
          scale: createAxis(1, 1),
          lift: createAxis(0, 0),
          cfg: dense ? SPRING.press : SPRING.follow,
          pressed: false,
          baseLeft: 0,
          baseTop: 0,
          width: 0,
          height: 0,
        }
        el.style.willChange = 'transform'
        tracks.set(el, track)
      }
      return track
    }

    const liftFor = (el: HTMLElement) => {
      const mode = el.dataset.tilt
      if (mode === 'dense' || mode === 'follow' || mode === 'panel') return 0
      return -4
    }

    const release = (el: HTMLElement) => {
      const track = tracks.get(el)
      if (!track) return
      retarget(track.x, 0)
      retarget(track.y, 0)
      retarget(track.lift, 0)
      track.width = 0
      wake()
    }

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      pointerTarget = event.target
      wake()
    }

    const onOut = (event: PointerEvent) => {
      if (!hovered) return
      const next = event.relatedTarget
      if (next instanceof Node && hovered.contains(next)) return
      release(hovered)
      hovered = null
      pointerTarget = null
    }

    const onDown = (event: PointerEvent) => {
      const t = event.target
      if (!(t instanceof Element)) return
      if (t.closest(NO_TILT_ZONE)) {
        if (hovered) {
          release(hovered)
          hovered = null
        }
        return
      }
      const el = resolveTarget(t)
      if (!el) return
      const track = trackOf(el)
      track.pressed = true
      retarget(track.scale, 0.985)
      wake()
    }

    const onUp = () => {
      for (const track of tracks.values()) {
        if (!track.pressed) continue
        track.pressed = false
        retarget(track.scale, 1)
      }
      wake()
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointerdown', onDown, { passive: true })
    document.addEventListener('pointerup', onUp, { passive: true })
    document.addEventListener('pointercancel', onUp, { passive: true })

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      if (raf) cancelAnimationFrame(raf)
      for (const el of tracks.keys()) clear(el)
      tracks.clear()
    }
  }, [])

  return null
}
