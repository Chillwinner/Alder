/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      version='1.1'
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 64 64'
      className={className}
    >
      <rect
        x='0'
        y='0'
        width='64'
        height='64'
        rx='16'
        ry='16'
        fill='currentColor'
        stroke='var(--hud-bright)'
        strokeOpacity='0.55'
        strokeWidth='2'
      />
      <line
        x1='18'
        y1='19'
        x2='46'
        y2='19'
        fill='none'
        stroke='var(--primary-foreground)'
        strokeWidth='7'
        strokeLinecap='round'
      />
      <line
        x1='18'
        y1='32'
        x2='34'
        y2='32'
        fill='none'
        stroke='var(--primary-foreground)'
        strokeWidth='7'
        strokeLinecap='round'
      />
      <circle cx='45' cy='32' r='3.5' fill='var(--primary-foreground)' />
      <line
        x1='18'
        y1='45'
        x2='26'
        y2='45'
        fill='none'
        stroke='var(--primary-foreground)'
        strokeWidth='7'
        strokeLinecap='round'
      />
    </svg>
  )
}
