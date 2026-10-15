/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

interface KineticTitleProps {
  /** i18n 完整文本；视觉层拆字入场，可访问名保留全文 */
  text: string
  className?: string
}

/**
 * 主标题逐字入场。拆字只发生在展示层：
 * h3 的可访问名来自 aria-label（完整文本），字符 span 全部 aria-hidden；
 * 语言切换时 text 变化 → 以 text 为 key 重挂载并重播动画，不破坏 i18n 渲染。
 */
export function KineticTitle({ text, className }: KineticTitleProps) {
  const chars = Array.from(text)
  return (
    <h3 aria-label={text} className={className}>
      <span aria-hidden key={text} className='lfx-kinetic'>
        {chars.map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            className='lfx-char'
            style={{
              animationDelay: `${Math.min(0.16 + i * 0.03, 0.42).toFixed(3)}s`,
            }}
          >
            {ch}
          </span>
        ))}
      </span>
    </h3>
  )
}
