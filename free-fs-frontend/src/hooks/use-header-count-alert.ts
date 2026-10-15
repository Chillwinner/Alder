/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { playNotificationChime } from '@/lib/notification-chime'

/**
 * 未读数相对上次增加时触发短动画 + 轻提示音（跳过首次拉取，避免进页就响）。
 */
export function useHeaderCountAlert(count: number, enabled = true) {
  const initialized = useRef(false)
  const previous = useRef(0)
  const [alerting, setAlerting] = useState(false)

  useEffect(() => {
    if (!enabled) {
      initialized.current = false
      previous.current = 0
      setAlerting(false)
      return
    }

    if (!initialized.current) {
      initialized.current = true
      previous.current = count
      return
    }

    if (count > previous.current) {
      setAlerting(true)
      playNotificationChime()
      const timer = window.setTimeout(() => setAlerting(false), 2600)
      previous.current = count
      return () => window.clearTimeout(timer)
    }

    previous.current = count
  }, [count, enabled])

  return alerting
}

/** 未关闭的闹钟：铃铛持续摇、提示音循环，直到 inbox 清空。 */
export function useHeaderAlarmRing(active: boolean) {
  useEffect(() => {
    if (!active) return undefined
    playNotificationChime()
    const timer = window.setInterval(() => playNotificationChime(), 2200)
    return () => window.clearInterval(timer)
  }, [active])
  return active
}
