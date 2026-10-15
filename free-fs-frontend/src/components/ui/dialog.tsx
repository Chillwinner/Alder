'use client'

/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  DialogWindowChrome,
  dialogExpandedClass,
} from '@/components/dialog-window-chrome'
import { cn } from '@/lib/utils'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot='dialog' {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot='dialog-trigger' {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot='dialog-portal' {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot='dialog-close' {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot='dialog-overlay'
      className={cn(
        /*
         * ⚠️ `data-[state=closed]:pointer-events-none` 不能删。
         *
         * Radix 在关闭动画期间会**保留** overlay 于 DOM 中（data-state=closed），
         * 此时它是 `fixed inset-0 z-50` —— 一块铺满全屏的隐形遮罩。
         * 只靠 animate-out 把它淡到 opacity:0 **不会**让它停止接收指针事件，
         * 于是整页的 pointermove/click 全被这块透明层吃掉：
         * 表现为「卡片 hover 动效、指针跟随、点击、拖拽全部失灵」，
         * 而且肉眼完全看不出有问题（实测 elementFromPoint 命中的就是这层）。
         */
        'fixed inset-0 z-50 bg-black/40 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton: _showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const closeRef = React.useRef<HTMLButtonElement>(null)

  // 检查 children 中是否已经包含 DialogDescription
  const hasDescription = React.Children.toArray(children).some((child) => {
    if (React.isValidElement(child)) {
      return child.type === DialogDescription || child.type === DialogPrimitive.Description
    }
    return false
  })

  return (
    <DialogPortal data-slot='dialog-portal'>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot='dialog-content'
        className={cn(
          'glass-overlay fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl p-6 duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-3 sm:max-w-lg',
          expanded && dialogExpandedClass,
          className
        )}
        onCloseAutoFocus={() => setExpanded(false)}
        {...props}
      >
        <DialogWindowChrome
          expanded={expanded}
          onToggleExpand={() => setExpanded((value) => !value)}
          onClose={() => closeRef.current?.click()}
        />
        <DialogPrimitive.Close ref={closeRef} className='sr-only' />
        {children}
        {/* 如果没有 DialogDescription，添加一个隐藏的空描述以满足无障碍要求 */}
        {!hasDescription && (
          <DialogPrimitive.Description className='sr-only'>
            Dialog content
          </DialogPrimitive.Description>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-header'
      className={cn('flex flex-col gap-2 pe-16 text-start', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='dialog-footer'
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot='dialog-title'
      className={cn('text-sm leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot='dialog-description'
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}