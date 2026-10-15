/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { Heading1, Heading2, Heading3, List, ListOrdered, Quote } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger, ContextMenuGroup } from '@/components/ui/context-menu'

type Props = {
  editor: Editor | null
  children: ReactNode
}

export function MemoFormatChrome({ editor, children }: Props) {
  const { t } = useTranslation('board')

  if (!editor) return children

  const run = (fn: () => void) => {
    fn()
    editor.chain().focus().run()
  }

  return (
    <ContextMenu
      modal={false}
      onOpenChange={(open) => {
        if (!open) editor.commands.focus()
      }}
    >
      <ContextMenuTrigger asChild>
        <div className='memo-format-host relative flex h-full min-h-0 min-w-0 flex-1 flex-col'>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className='min-w-48'>
<ContextMenuGroup>
        <ContextMenuCheckboxItem
          checked={editor.isActive('bold')}
          onSelect={() => run(() => editor.chain().toggleBold().run())}
        >
          {t('editor.bold')}
          <ContextMenuShortcut>⌘B</ContextMenuShortcut>
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={editor.isActive('italic')}
          onSelect={() => run(() => editor.chain().toggleItalic().run())}
        >
          {t('editor.italic')}
          <ContextMenuShortcut>⌘I</ContextMenuShortcut>
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={editor.isActive('strike')}
          onSelect={() => run(() => editor.chain().toggleStrike().run())}
        >
          {t('editor.strike')}
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          checked={editor.isActive('code')}
          onSelect={() => run(() => editor.chain().toggleCode().run())}
        >
          {t('editor.code')}
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleHeading({ level: 1 }).run())}>
          <Heading1 className='mr-2 size-3.5' />
          {t('editor.heading1')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleHeading({ level: 2 }).run())}>
          <Heading2 className='mr-2 size-3.5' />
          {t('editor.heading2')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleHeading({ level: 3 }).run())}>
          <Heading3 className='mr-2 size-3.5' />
          {t('editor.heading3')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleBulletList().run())}>
          <List className='mr-2 size-3.5' />
          {t('editor.bulletList')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleOrderedList().run())}>
          <ListOrdered className='mr-2 size-3.5' />
          {t('editor.orderedList')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => run(() => editor.chain().toggleBlockquote().run())}>
          <Quote className='mr-2 size-3.5' />
          {t('editor.quote')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => run(() => editor.chain().unsetAllMarks().clearNodes().run())}
        >
          {t('editor.clearFormat')}
        </ContextMenuItem>
      </ContextMenuGroup>
</ContextMenuContent>
    </ContextMenu>
  )
}
