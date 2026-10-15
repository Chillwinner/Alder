/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { stabilizeWorkspacePath } from '@/lib/workspace-path'

/** 级联单元选择器：页头 + 区块面板（主面板按规范必带 glass-card / data-tilt）。 */
const CASCADE_SELECTOR = 'header, section, .glass-card, [data-tilt]'
/** 步进 60ms（50–70ms 区间），延迟上限 420ms，动画 0.48s → 级联总时长 ≤ 0.9s。 */
const CASCADE_STEP_MS = 36
const CASCADE_MAX_DELAY_MS = 240

/** 路由切换时让当前页区块按序级联入场（上浮 + blur 消散，moCascade 见 styles/motion.css）。 */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const pageKey = stabilizeWorkspacePath(pathname)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const seen = new WeakSet<HTMLElement>()
    let seq = 0

    // 单个单元入场：remove → reflow → add 重放，兼容既有 art-card-pop 机制
    const play = (el: HTMLElement) => {
      if (seen.has(el)) return
      seen.add(el)
      if (el.offsetParent === null) {
        // 隐藏单元不占节拍；清掉历史 inline 值，避免残留旧延迟，
        // 显示时回落到样式表的 art-card-pop
        el.style.animation = ''
        el.style.animationDelay = ''
        return
      }
      el.style.animation = 'none'
      void el.offsetWidth
      if (reduce) {
        // 降级：回退到样式表动画（全局 reduced-motion 会将其归零）
        el.style.animation = ''
        el.style.animationDelay = ''
        return
      }
      // moCascade 的 keyframes 在 styles/motion.css；缺失时无动画、内容直接可见
      // ⚠️ 用 backwards 而不是 both：both 会在动画结束后继续填充 translate，
      //    把样式表里的 [data-tilt]:hover { translate: 0 -4px } 钉死 → 悬停抬升失效。
      el.style.animation = 'moCascade 0.32s ease-out backwards'
      const delay = Math.min(seq * CASCADE_STEP_MS, CASCADE_MAX_DELAY_MS)
      el.style.animationDelay = `${delay}ms`
      seq += 1

      /*
        ★ 动画播完后**主动清掉** inline animation —— 这是修「鼠标移出卡片闪一下」的关键。
        ----------------------------------------------------------------------------
        原因链路（实测逐帧确认）：
          1. [data-tilt]:hover { animation: none } 只在**悬停期间**压制入场动画
          2. inline 的 `animation: moCascade …` 一直挂在元素上
          3. 鼠标一移出，:hover 失效 → moCascade **立刻复活重播**
             → 卡片被拽回 translate3d(0,14px,0) 再淡入 = 肉眼看到"闪一下"
        实测：移出后 90/90 帧 computedAnimationName 都是 'moCascade'，
              且 translate 出现 0 → -5px → 0 → +0.19px 的来回过冲（两套机制打架）。

        用 animationend 在播完的瞬间清空 inline 值，
        之后元素上就没有任何动画可复活了。
        ⚠️ 必须 { once: true } 并做存在性判断，避免重复绑定。
      */
      const clear = () => {
        el.style.animation = ''
        el.style.animationDelay = ''
      }
      el.addEventListener('animationend', clear, { once: true })
      // 兜底：若 animationend 因元素被移除/降级而没触发，延迟后强制清一次
      window.setTimeout(() => {
        if (el.style.animation) clear()
      }, delay + 700)
    }

    try {
      root
        .querySelectorAll<HTMLElement>(CASCADE_SELECTOR)
        .forEach((el) => play(el))
    } catch {
      /* 选择器异常时静默，保持页面可见 */
    }
  }, [pageKey])

  return (
    <div key={pageKey} ref={ref} className='art-page-view flex min-h-0 flex-1 flex-col overflow-auto'>
      {children}
    </div>
  )
}
