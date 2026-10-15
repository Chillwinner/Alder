/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import React, { forwardRef, useRef } from 'react'
import { cn } from '@/lib/utils'
import { AnimatedBeam } from '@/components/ui/animated-beam'

const Circle = forwardRef<
  HTMLDivElement,
  { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'z-10 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-card p-3 shadow-lg shadow-primary/10',
        className
      )}
    >
      {children}
    </div>
  )
})

Circle.displayName = 'Circle'

export function AnimatedBeamDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const div1Ref = useRef<HTMLDivElement>(null)
  const div2Ref = useRef<HTMLDivElement>(null)
  const div3Ref = useRef<HTMLDivElement>(null)
  const div4Ref = useRef<HTMLDivElement>(null)
  const div5Ref = useRef<HTMLDivElement>(null)
  const div6Ref = useRef<HTMLDivElement>(null)
  const div7Ref = useRef<HTMLDivElement>(null)

  return (
    <div
      className='relative flex h-[300px] w-full items-center justify-center overflow-hidden p-10'
      ref={containerRef}
    >
      <div className='flex size-full max-h-[200px] max-w-lg flex-col items-stretch justify-between gap-10'>
        <div className='flex flex-row items-center justify-between'>
          <Circle ref={div1Ref}>
            <Icons.cloud />
          </Circle>
          <Circle ref={div5Ref}>
            <Icons.folder />
          </Circle>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <Circle ref={div2Ref}>
            <Icons.file />
          </Circle>
          <Circle ref={div4Ref} className='size-16'>
            <Icons.server />
          </Circle>
          <Circle ref={div6Ref}>
            <Icons.share />
          </Circle>
        </div>
        <div className='flex flex-row items-center justify-between'>
          <Circle ref={div3Ref}>
            <Icons.lock />
          </Circle>
          <Circle ref={div7Ref}>
            <Icons.upload />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div4Ref}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div5Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
        reverse
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div6Ref}
        toRef={div4Ref}
        reverse
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div7Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
        reverse
      />
    </div>
  )
}

const Icons = {
  cloud: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='cloudGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <path
        d='M18.5 19H7C4.79086 19 3 17.2091 3 15C3 12.7909 4.79086 11 7 11C7 7.68629 9.68629 5 13 5C16.3137 5 19 7.68629 19 11C20.6569 11 22 12.3431 22 14C22 15.6569 20.6569 17 19 17H18.5V19Z'
        fill='url(#cloudGrad)'
        stroke='url(#cloudGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ),
  folder: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='folderGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <path
        d='M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z'
        fill='url(#folderGrad)'
        stroke='url(#folderGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ),
  file: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='fileGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <path
        d='M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z'
        fill='url(#fileGrad)'
        stroke='url(#fileGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M14 2V8H20'
        stroke='var(--background)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ),
  server: () => (
    <svg
      width='28'
      height='28'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='serverGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--primary)' />
          <stop offset='100%' stopColor='var(--primary)' stopOpacity='0.6' />
        </linearGradient>
      </defs>
      <rect
        x='2'
        y='2'
        width='20'
        height='6'
        rx='2'
        fill='url(#serverGrad)'
        stroke='url(#serverGrad)'
        strokeWidth='2'
      />
      <rect
        x='2'
        y='10'
        width='20'
        height='6'
        rx='2'
        fill='url(#serverGrad)'
        stroke='url(#serverGrad)'
        strokeWidth='2'
      />
      <rect
        x='2'
        y='18'
        width='20'
        height='4'
        rx='2'
        fill='url(#serverGrad)'
        stroke='url(#serverGrad)'
        strokeWidth='2'
      />
      <circle cx='6' cy='5' r='1' fill='var(--background)' />
      <circle cx='6' cy='13' r='1' fill='var(--background)' />
      <circle cx='6' cy='20' r='1' fill='var(--background)' />
    </svg>
  ),
  share: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='shareGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <circle
        cx='18'
        cy='5'
        r='3'
        fill='url(#shareGrad)'
        stroke='url(#shareGrad)'
        strokeWidth='2'
      />
      <circle
        cx='6'
        cy='12'
        r='3'
        fill='url(#shareGrad)'
        stroke='url(#shareGrad)'
        strokeWidth='2'
      />
      <circle
        cx='18'
        cy='19'
        r='3'
        fill='url(#shareGrad)'
        stroke='url(#shareGrad)'
        strokeWidth='2'
      />
      <path
        d='M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49'
        stroke='url(#shareGrad)'
        strokeWidth='2'
      />
    </svg>
  ),
  lock: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='lockGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <rect
        x='5'
        y='11'
        width='14'
        height='10'
        rx='2'
        fill='url(#lockGrad)'
        stroke='url(#lockGrad)'
        strokeWidth='2'
      />
      <path
        d='M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11'
        stroke='url(#lockGrad)'
        strokeWidth='2'
        strokeLinecap='round'
      />
      <circle cx='12' cy='16' r='1.5' fill='var(--background)' />
    </svg>
  ),
  upload: () => (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <defs>
        <linearGradient id='uploadGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='var(--hud)' />
          <stop offset='100%' stopColor='var(--hud)' stopOpacity='0.55' />
        </linearGradient>
      </defs>
      <path
        d='M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15'
        stroke='url(#uploadGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M17 8L12 3L7 8'
        stroke='url(#uploadGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M12 3V15'
        stroke='url(#uploadGrad)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ),
}
