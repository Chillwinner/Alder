/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 弹簧求解器 —— iOS「生动感」的真正来源。
 * ============================================================
 *
 * 为什么不能只调 CSS 缓动曲线：
 *   CSS transition / keyframes 是**时间轴驱动**的 —— 给定起点、终点、时长，
 *   中间插值由曲线决定。它有两个致命限制：
 *     ① 不可中断：中途改目标只能重新计时，速度会断掉（视觉上是「一顿」）。
 *     ② 无速度继承：反向时从 0 速度重新起步，没有惯性。
 *   iOS 的动效是**物理驱动**的：每个元素的运动由当前位移 + 当前速度决定，
 *   目标随时可变，速度连续传递。所以拖到一半松手、hover 到一半划走，
 *   动作永远「接得上」—— 这就是「生动」和「机械」的分界。
 *
 * 本模块实现一个标准的阻尼谐振子（damped harmonic oscillator）：
 *
 *     a = (-k·x - c·v) / m
 *     v += a·dt
 *     x += v·dt
 *
 *   x = 位移偏差（当前值 − 目标值）
 *   v = 速度
 *   k = 刚度 stiffness（越大越快回到目标）
 *   c = 阻尼 damping（越大越不容易过冲）
 *   m = 质量 mass（越大越"重"，越慢）
 *
 * 用**解析解**而不是逐帧欧拉积分：欧拉在 dt 抖动时会发散或抖振，
 * 解析解对任意 dt 都稳定，且能精确算出「何时停下」。
 */

/** 弹簧参数。用例直接引用 SPRING 预设，不要散落魔数。 */
export type SpringConfig = {
  /** 刚度：回到目标的速度 */
  stiffness: number
  /** 阻尼：抑制振荡 */
  damping: number
  /** 质量：惯性大小 */
  mass: number
  /** 静息阈值：位移与速度都小于它即判定停止 */
  restDelta: number
  /** 速度阈值 */
  restSpeed: number
}

/**
 * 预设：按交互语义分档，而不是按元素大小。
 *
 * damping ratio ζ = c / (2·√(k·m))
 *   ζ < 1 欠阻尼 → 过冲回弹（iOS 的手感）
 *   ζ = 1 临界阻尼 → 平滑无过冲
 *   ζ > 1 过阻尼 → 迟滞
 */
export const SPRING = {
  /**
   * 跟手追随：指针在卡片上移动时卡片轻微跟进。
   * 临界阻尼（ζ≈1），刻意不过冲 —— 跟随一旦过冲就会「晃」，像坏了。
   * 刚度高 = 跟得紧。
   */
  follow: {
    stiffness: 280,
    damping: 34,
    mass: 1,
    restDelta: 0.08,
    restSpeed: 0.08,
  } as SpringConfig,

  /**
   * 悬停抬升：ζ≈0.72，约 12% 过冲后收敛。
   * 这是「弹起来」的手感来源 —— 轻微过冲才显得有生命。
   */
  lift: {
    stiffness: 380,
    damping: 32,
    mass: 1,
    restDelta: 0.1,
    restSpeed: 0.1,
  } as SpringConfig,

  /**
   * 按压缩放：更快更硬（ζ≈0.85），按下必须立刻有反馈，不能软。
   */
  press: {
    stiffness: 900,
    damping: 58,
    mass: 1,
    restDelta: 0.02,
    restSpeed: 0.02,
  } as SpringConfig,

  /**
   * 入场：ζ≈0.8，位移从中带一点过冲收尾，比纯 ease-out 更有「落位感」。
   */
  enter: {
    stiffness: 380,
    damping: 30,
    mass: 1,
    restDelta: 0.1,
    restSpeed: 0.1,
  } as SpringConfig,
} as const

/** 单个标量弹簧的运行状态 */
type Axis = {
  /** 当前位置 */
  value: number
  /** 当前速度 */
  velocity: number
  /** 目标位置 */
  target: number
}

export function createAxis(value = 0, target = 0): Axis {
  return { value, velocity: 0, target }
}

/** 给弹簧换目标。**保留当前速度** —— 这正是「可中断」的全部秘密。 */
export function retarget(axis: Axis, target: number) {
  axis.target = target
}

/**
 * 让弹簧瞬间就位（用于初始化、或用户要求降级动效时）。
 */
export function snap(axis: Axis, target: number) {
  axis.value = target
  axis.velocity = 0
  axis.target = target
}

/** 是否已经静止 */
export function isAtRest(axis: Axis, cfg: SpringConfig): boolean {
  return (
    Math.abs(axis.target - axis.value) < cfg.restDelta &&
    Math.abs(axis.velocity) < cfg.restSpeed
  )
}

/**
 * 推进一帧。
 *
 * 用**解析解**求阻尼谐振子在 dt 后的状态：
 * 这样即使 rAF 掉帧（dt 忽大忽小）也不会发散，
 * 而朴素的 `v += a*dt; x += v*dt` 在大 dt 下会炸。
 *
 * 过阻尼 / 临界 / 欠阻尼三种情况分别有不同的闭式解，
 * 这里把它们统一写出来，避免用「足够小的 dt」去赌数值稳定性。
 */
export function step(axis: Axis, cfg: SpringConfig, dt: number): void {
  // 极端 dt（切标签页回来）直接吸附，避免一帧跳一大步
  if (dt <= 0) return
  if (dt > 0.064) dt = 0.064

  const { stiffness: k, damping: c, mass: m } = cfg
  // 位移以「到目标的偏差」为基准解，解完再折回绝对值
  const x0 = axis.value - axis.target
  const v0 = axis.velocity

  const omega0 = Math.sqrt(k / m) // 固有频率
  const zeta = c / (2 * Math.sqrt(k * m)) // 阻尼比

  let x: number
  let v: number

  if (zeta < 1) {
    // 欠阻尼：带振荡的衰减（会过冲 —— 我们要的回弹）
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * dt)
    const cosTerm = Math.cos(omegaD * dt)
    const sinTerm = Math.sin(omegaD * dt)
    const A = x0
    const B = (v0 + zeta * omega0 * x0) / omegaD

    x = decay * (A * cosTerm + B * sinTerm)
    v =
      decay *
      (-zeta * omega0 * (A * cosTerm + B * sinTerm) +
        omegaD * (-A * sinTerm + B * cosTerm))
  } else if (Math.abs(zeta - 1) < 1e-6) {
    // 临界阻尼：最快无过冲收敛
    const decay = Math.exp(-omega0 * dt)
    const A = x0
    const B = v0 + omega0 * x0
    x = decay * (A + B * dt)
    v = decay * (B - omega0 * (A + B * dt))
  } else {
    // 过阻尼：两个实根，缓慢逼近
    const sq = Math.sqrt(zeta * zeta - 1)
    const r1 = -omega0 * (zeta - sq)
    const r2 = -omega0 * (zeta + sq)
    const A = (v0 - r2 * x0) / (r1 - r2)
    const B = x0 - A
    const e1 = Math.exp(r1 * dt)
    const e2 = Math.exp(r2 * dt)
    x = A * e1 + B * e2
    v = A * r1 * e1 + B * r2 * e2
  }

  axis.value = axis.target + x
  axis.velocity = v

  // 夹紧：解析解理论上收敛，但浮点误差可能让极小的残留永远震荡
  if (isAtRest(axis, cfg)) {
    axis.value = axis.target
    axis.velocity = 0
  }
}
