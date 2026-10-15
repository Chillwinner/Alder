/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ReactPptxViewer,
  setWasmSource,
  usePptxViewerThumbnails,
  type PptxViewerController,
} from '@extend-ai/react-pptx'
import { previewPaneClass } from '@/components/preview/preview-glass'
import { cn } from '@/lib/utils'
import '@extend-ai/react-pptx/styles.css'
import wasmUrl from '@extend-ai/react-pptx/pptx_wasm_bg.wasm?url'

type PptxPreviewProps = {
  blob: Blob
}

const PPTX_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function PptxPreview({ blob }: PptxPreviewProps) {
  const { t } = useTranslation('common')
  const [wasmReady, setWasmReady] = useState(false)
  const [wasmError, setWasmError] = useState(false)
  const source = useMemo(() => {
    if (blob.type.includes('presentation') || blob.type.includes('powerpoint')) {
      return blob
    }
    return new Blob([blob], { type: PPTX_TYPE })
  }, [blob])

  useEffect(() => {
    let cancelled = false
    void fetch(wasmUrl)
      .then((response) => {
        if (!response.ok) throw new Error('wasm')
        return response.arrayBuffer()
      })
      .then((bytes) => {
        if (cancelled) return
        setWasmSource({ module_or_path: bytes } as never)
        setWasmReady(true)
      })
      .catch(() => {
        if (!cancelled) setWasmError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (wasmError) {
    return (
      <div className={cn(previewPaneClass, 'text-destructive flex h-full min-h-[20rem] items-center justify-center text-sm')}>
        {t('preview.loadFailed')}
      </div>
    )
  }

  if (!wasmReady) {
    return (
      <div className={cn(previewPaneClass, 'text-muted-foreground flex h-full min-h-[20rem] items-center justify-center text-sm')}>
        {t('loading')}
      </div>
    )
  }

  return <PptxPreviewReady source={source} />
}

function PptxPreviewReady({ source }: { source: Blob }) {
  const { t } = useTranslation('common')
  const paneRef = useRef<HTMLDivElement>(null)
  const [viewerHeight, setViewerHeight] = useState(480)
  const [controller, setController] = useState<PptxViewerController | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const { thumbnails } = usePptxViewerThumbnails(controller, { resolution: 140 })

  useEffect(() => {
    setSlideIndex(0)
  }, [source])

  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const apply = () => {
      const next = Math.floor(el.clientHeight)
      if (next > 0) setViewerHeight(next)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const goTo = (index: number) => {
    setSlideIndex(index)
    void controller?.goToSlide(index)
  }

  return (
    <div className={cn(previewPaneClass, 'flex h-full min-h-0 w-full overflow-hidden rounded-md')}>
      <nav
        className='border-border/40 flex w-[9.5rem] shrink-0 flex-col overflow-y-auto border-r px-2 py-2'
        aria-label={t('pagination.pageOf', { current: slideIndex + 1, total: Math.max(thumbnails.length, 1) })}
      >
        {thumbnails.map((thumb) => {
          const active = thumb.slideIndex === slideIndex
          return (
            <button
              key={thumb.slideIndex}
              type='button'
              onClick={() => goTo(thumb.slideIndex)}
              aria-current={active ? 'page' : undefined}
              aria-label={t('pagination.pageSr', { n: thumb.slideNumber })}
              className={cn(
                'mb-2 flex w-full flex-col gap-1 rounded-md p-1 text-left transition-colors duration-150',
                active
                  ? 'bg-accent-soft text-primary ring-1 ring-primary/40'
                  : 'hover:bg-surface-hover'
              )}
            >
              <span className='text-muted-foreground px-0.5 font-mono text-[11px] font-medium tracking-wider tabular-nums'>
                {String(thumb.slideNumber).padStart(2, '0')}
              </span>
              <div
                ref={thumb.containerRef}
                className='aspect-[16/9] w-full overflow-hidden rounded-sm bg-surface-3'
              />
            </button>
          )
        })}
      </nav>
      <div ref={paneRef} className='min-h-0 min-w-0 flex-1'>
        <ReactPptxViewer
          source={source}
          height={viewerHeight}
          mode='paged'
          slideIndex={slideIndex}
          virtualization={false}
          showToolbar
          showThumbnails={false}
          onReady={setController}
          onSlideChange={setSlideIndex}
          renderLoading={() => (
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              {t('loading')}
            </div>
          )}
          renderError={() => (
            <div className='text-destructive flex h-full items-center justify-center text-sm'>
              {t('preview.loadFailed')}
            </div>
          )}
        />
      </div>
    </div>
  )
}
