/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return null
    audioContext = new Ctx()
  }
  return audioContext
}

/** 在用户点击等手势后调用，避免首次 Web Audio 被浏览器静音策略拦截 */
export function primeNotificationAudio() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
}

export function playNotificationChime() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const ctx = getAudioContext()
  if (!ctx) return

  const run = () => {
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(784, now)
      osc.frequency.exponentialRampToValueAtTime(988, now + 0.06)
      osc.frequency.exponentialRampToValueAtTime(659, now + 0.18)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
      osc.start(now)
      osc.stop(now + 0.34)
    } catch {
      // ignore
    }
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => undefined)
    return
  }
  run()
}
