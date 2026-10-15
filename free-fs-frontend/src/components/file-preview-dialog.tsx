/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getFileContent } from '@/api/file'
import { resolveMemoImageSrc } from '@/lib/memo-insert-image'
import { getShareFileAccessUrl, getShareFileContent } from '@/api/share'
import { FilePreviewBody } from '@/components/preview/file-preview-body'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DialogWindowChrome,
  dialogExpandedClass,
} from '@/components/dialog-window-chrome'
import { translateServerText } from '@/i18n'
import { useFloatingPanel } from '@/hooks/use-floating-panel'
import { usePreviewStore } from '@/store/preview'
import type { FileItem } from '@/types/file'
import {
  canPreviewInApp,
  getPreviewKind,
  isDirectMediaPreview,
  typedPreviewBlob,
} from '@/utils/preview'
import { cn } from '@/lib/utils'
import {
  previewChromeClass,
  previewOverlayClass,
  previewWindowClass,
} from '@/components/preview/preview-glass'

/*
  预览窗口「从触发点长出」由 content 上的内联 left/top/width/height 过渡完成，
  这里只补内容错峰：窗口壳 → 标题栏 → 正文依次落位。
*/
const PV_CSS = `
@keyframes afilePvRise{from{opacity:0;transform:translate3d(0,10px,0) scale(.985)}to{opacity:1;transform:none}}
.afile-pv-rise{animation:afilePvRise 460ms var(--ease-ios) backwards}
@media (prefers-reduced-motion: reduce){.afile-pv-rise{animation:none}}
`

export function FilePreviewDialog() {  const { t } = useTranslation('common')
  const file = usePreviewStore((state) => state.file)
  const navigationFiles = usePreviewStore((state) => state.navigationFiles)
  const shareId = usePreviewStore((state) => state.shareId)
  const sourceUrl = usePreviewStore((state) => state.sourceUrl)
  const openPreview = usePreviewStore((state) => state.open)
  const close = usePreviewStore((state) => state.close)
  const blockReopen = usePreviewStore((state) => state.blockReopen)
  const origin = usePreviewStore((state) => state.origin)
  const { rect, expanded, bindPanel, startMove, startResize, toggleExpanded } = useFloatingPanel(!!file)
  const [grown, setGrown] = useState(!origin)
  const [moving, setMoving] = useState(Boolean(origin))
  const [closing, setClosing] = useState(false)
  const sessionOpen = useRef(false)
  const originRef = useRef(origin)
  originRef.current = origin
  const closeTimer = useRef(0)

  useLayoutEffect(() => {
    if (!file) {
      sessionOpen.current = false
      setClosing(false)
      return
    }
    if (sessionOpen.current) return
    sessionOpen.current = true
    const card = origin
    if (!card) {
      setGrown(true)
      setMoving(false)
      setClosing(false)
      return
    }
    setClosing(false)
    setGrown(false)
    setMoving(true)
    const frame = requestAnimationFrame(() => setGrown(true))
    const timer = window.setTimeout(() => setMoving(false), 480)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [file, origin])

  useLayoutEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const requestClose = useCallback(() => {
    if (closing) {
      window.clearTimeout(closeTimer.current)
      close()
      return
    }
    blockReopen()
    if (expanded) {
      close()
      return
    }
    setClosing(true)
    const card = originRef.current
    if (card) {
      setMoving(true)
      setGrown(false)
      closeTimer.current = window.setTimeout(() => close(), 460)
      return
    }
    closeTimer.current = window.setTimeout(() => close(), 200)
  }, [blockReopen, close, closing, expanded])

  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [directUrl, setDirectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fallbackStartedRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)

  const supported = file ? canPreviewInApp(file) : false
  const siblings = useMemo(
    () => navigationFiles.filter((item) => !item.isDir && canPreviewInApp(item)),
    [navigationFiles]
  )
  const currentIndex = file ? siblings.findIndex((item) => item.id === file.id) : -1

  useEffect(() => {
    if (!file || !supported) {
      setBlob(null)
      setBlobUrl(null)
      setDirectUrl(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    fallbackStartedRef.current = false
    setLoading(true)
    setError(null)
    setBlob(null)
    setBlobUrl(null)
    setDirectUrl(null)

    const applyContentBlob = async () => {
      const raw = sourceUrl
        ? await fetch(sourceUrl, { credentials: 'include' }).then((response) => {
            if (!response.ok) throw new Error(t('preview.loadFailed'))
            return response.blob()
          })
        : shareId
          ? await getShareFileContent(shareId, file.id)
          : await getFileContent(file.id)
      if (cancelled) return
      const typed = typedPreviewBlob(file, raw)
      const objectUrl = URL.createObjectURL(typed)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      objectUrlRef.current = objectUrl
      setBlob(typed)
      setBlobUrl(objectUrl)
      setDirectUrl(null)
    }

    const load = async () => {
      try {
        if (isDirectMediaPreview(file)) {
          const url = sourceUrl
            ? sourceUrl
            : shareId
              ? await getShareFileAccessUrl(shareId, file.id, 3600, false)
              : resolveMemoImageSrc(`/apis/file/${file.id}/content`)
          if (cancelled) return
          setDirectUrl(url)
          setLoading(false)
          return
        }

        await applyContentBlob()
      } catch (cause) {
        if (cancelled) return
        const message =
          cause instanceof Error
            ? translateServerText(cause.message, t('preview.loadFailed'))
            : t('preview.loadFailed')
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [file, shareId, sourceUrl, supported, t])

  const handleMediaError = useCallback(() => {
    if (!file || fallbackStartedRef.current || !directUrl) {
      return
    }
    fallbackStartedRef.current = true
    setLoading(true)
    setError(null)
    const loadFallback = async () => {
      try {
        const raw = sourceUrl
          ? await fetch(sourceUrl, { credentials: 'include' }).then((response) => {
              if (!response.ok) throw new Error(t('preview.loadFailed'))
              return response.blob()
            })
          : shareId
            ? await getShareFileContent(shareId, file.id)
            : await getFileContent(file.id)
        const typed = typedPreviewBlob(file, raw)
        const objectUrl = URL.createObjectURL(typed)
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
        }
        objectUrlRef.current = objectUrl
        setBlob(typed)
        setBlobUrl(objectUrl)
        setDirectUrl(null)
      } catch (cause) {
        const message =
          cause instanceof Error
            ? translateServerText(cause.message, t('preview.loadFailed'))
            : t('preview.loadFailed')
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    void loadFallback()
  }, [directUrl, file, shareId, sourceUrl, t])

  const goTo = (next: FileItem) => {
    openPreview(next, { navigationFiles, shareId, sourceUrl, force: true })
  }

  const ready = Boolean(
    (blob && blobUrl) || (file && isDirectMediaPreview(file) && directUrl)
  )

  if (!file) {
    return null
  }

  return (
    <Dialog
      open
      modal={false}
      onOpenChange={(next) => {
        if (!next) requestClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay
          className={cn(previewOverlayClass, 'z-[100] pointer-events-none')}
          onPointerDown={(event) => {
            if (closing) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
        />
        {closing ? (
          <div
            className='fixed inset-0 z-[99]'
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          />
        ) : null}
        <DialogPrimitive.Content
          ref={bindPanel}
          data-slot='dialog-content'
          className={cn(
            'fixed z-[100] flex flex-col overflow-hidden border outline-none',
            previewWindowClass,
            !origin &&
              'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            !origin && closing && 'animate-out fade-out-0 zoom-out-95 duration-200',
            expanded ? dialogExpandedClass : 'rounded-[10px]',
            closing && 'pointer-events-none'
          )}
          style={
            expanded
              ? undefined
              : {
                  left: !grown && origin ? origin.left : rect.x,
                  top: !grown && origin ? origin.top : rect.y,
                  width: !grown && origin ? origin.width : rect.w,
                  height: !grown && origin ? origin.height : rect.h,
                  borderRadius: !grown && origin ? 20 : 10,
                  transform: 'none',
                  opacity: closing && origin ? 0 : 1,
                  transition: moving
                    ? 'left 460ms cubic-bezier(0.22, 1, 0.36, 1), top 460ms cubic-bezier(0.22, 1, 0.36, 1), width 460ms cubic-bezier(0.22, 1, 0.36, 1), height 460ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease'
                    : undefined,
                }
          }
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <style>{PV_CSS}</style>
          <DialogWindowChrome
            expanded={expanded}
            onToggleExpand={toggleExpanded}
            onClose={requestClose}
          />

          <div
            style={{ animationDelay: '70ms' }}
            className={cn(
              previewChromeClass,
              'afile-pv-rise flex shrink-0 items-center gap-2 border-b border-border ps-3 pe-20 py-2 select-none',
              expanded ? 'cursor-default' : 'cursor-move'
            )}
            onPointerDown={startMove}
          >
            <div className='min-w-0 flex-1'>
              <DialogTitle className='truncate font-mono text-[12.5px] font-medium tracking-tight text-text-secondary'>
                {file?.displayName || t('preview.title')}
              </DialogTitle>
              <DialogDescription className='sr-only'>
                {t('preview.title')}
              </DialogDescription>
            </div>
          </div>

          <div
            style={{ animationDelay: '130ms' }}
            className={cn(
              previewChromeClass,
              'afile-pv-rise relative flex min-h-0 flex-1 flex-col p-3'
            )}
          >
            {siblings.length > 1 && currentIndex >= 0 && file && getPreviewKind(file) !== 'pptx' && (
              <>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='absolute top-1/2 left-2 z-10 -translate-y-1/2 border-border-strong bg-surface/85 backdrop-blur-sm transition-all duration-150 hover:border-primary/50 hover:bg-surface-hover hover:text-foreground active:scale-95'
                  disabled={currentIndex <= 0}
                  onClick={() => goTo(siblings[currentIndex - 1])}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='absolute top-1/2 right-2 z-10 -translate-y-1/2 border-border-strong bg-surface/85 backdrop-blur-sm transition-all duration-150 hover:border-primary/50 hover:bg-surface-hover hover:text-foreground active:scale-95'
                  disabled={currentIndex >= siblings.length - 1}
                  onClick={() => goTo(siblings[currentIndex + 1])}
                >
                  <ChevronRight />
                </Button>
              </>
            )}

            {!file ? null : !supported ? (
              <div className='text-muted-foreground flex h-full items-center justify-center px-8 text-center text-sm'>
                {t('preview.unsupportedType')}
              </div>
            ) : loading ? (
              <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
                {t('loading')}
              </div>
            ) : error ? (
              <div className='text-destructive flex h-full items-center justify-center px-8 text-center text-sm'>
                {error}
              </div>
            ) : ready ? (
              <div className='relative z-[1] flex h-full min-h-0 flex-1 flex-col pointer-events-auto'>
                <FilePreviewBody
                  file={file}
                  blob={blob}
                  blobUrl={blobUrl}
                  src={directUrl}
                  onMediaError={handleMediaError}
                />
              </div>
            ) : null}
          </div>

          {!expanded && (
            <div
              aria-hidden
              className='absolute right-0 bottom-0 z-30 size-5 cursor-se-resize'
              onPointerDown={startResize('se')}
            >
              <svg viewBox='0 0 16 16' className='size-full text-muted-foreground/70'>
                <path d='M14 16L16 14V16H14ZM10 16L16 10V12L12 16H10ZM6 16L16 6V8L8 16H6Z' fill='currentColor' />
              </svg>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
