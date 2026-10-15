/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface GifThumbnailProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
}

/**
 * GIF 默认只绘制第一帧，鼠标悬停时才挂载原图播放。
 * 仅在进入视口附近后加载，避免文件列表中的 GIF 同时解码。
 */
export function GifThumbnail({
  src,
  alt,
  className,
  width = 190,
  height = 150,
}: GifThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [frameReady, setFrameReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const captureStaticFrame = (image: HTMLImageElement) => {
    if (frameReady) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !image.naturalWidth || !image.naturalHeight) return

    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    context.clearRect(0, 0, width, height)
    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    )
    setFrameReady(true)
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => setIsPlaying(true)}
      onMouseLeave={() => setIsPlaying(false)}
      aria-label={alt}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className='h-full w-full object-cover'
        aria-hidden='true'
      />
      {shouldLoad && !frameReady && (
        <img
          src={src}
          alt=''
          loading='lazy'
          decoding='async'
          className='absolute inset-0 h-full w-full opacity-0 pointer-events-none'
          aria-hidden='true'
          onLoad={(event) => captureStaticFrame(event.currentTarget)}
        />
      )}
      {frameReady && isPlaying && (
        <img
          src={src}
          alt={alt}
          decoding='async'
          className='absolute inset-0 h-full w-full object-cover pointer-events-none select-none'
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
    </div>
  )
}
