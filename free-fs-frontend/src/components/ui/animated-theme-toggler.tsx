/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'
import { flushSync } from 'react-dom'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<'button'> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { theme, setTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // 判断当前是否是暗色主题
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) return

    const newTheme = isDark ? 'light' : 'dark'

    // 浏览器不支持 View Transition API 或用户偏好减少动效 → 直接切换（无动画）
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reduceMotion || !document.startViewTransition) {
      setTheme(newTheme, false)
      return
    }

    // 以按钮中心为圆形扩散起点
    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    try {
      await document.startViewTransition(() => {
        flushSync(() => {
          setTheme(newTheme, false) // 禁用 ThemeProvider 的动画，使用自定义动画
        })
      }).ready
    } catch {
      // 过渡被跳过（页面隐藏等）时主题已完成切换，静默降级
      return
    }

    const root = document.documentElement
    // 白→黑：新暗色从按钮扩出；黑→白：旧暗色从四周缩回按钮
    if (isDark) {
      root.classList.add('theme-vt-retract')
      const animation = root.animate(
        {
          clipPath: [
            `circle(${maxRadius}px at ${x}px ${y}px)`,
            `circle(${0}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-old(root)',
        }
      )
      void animation.finished.finally(() => {
        root.classList.remove('theme-vt-retract')
      })
      return
    }

    root.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  }, [isDark, setTheme, duration])

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {isDark ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
      <span className='sr-only'>Toggle theme</span>
    </button>
  )
}
