/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { insertMemoImagesFromFiles } from '@/lib/memo-insert-image'
import { normalizeMemoLinkHref } from '@/lib/memo-insert-link'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  editor: Editor | null
  className?: string
  fileshareFolderId?: string | null
}

const pillToggleClass =
  'size-8 min-w-8 rounded-full p-0 text-text-secondary hover:bg-surface hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm'
const pillButtonClass =
  'size-8 rounded-full p-0 text-text-secondary hover:bg-surface hover:text-foreground'
const pillDividerClass = 'mx-0.5 h-5 w-px shrink-0 bg-border/70'

export function MemoEditorToolbar({
  editor,
  className,
  fileshareFolderId,
}: Props) {
  const { t } = useTranslation('board')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageBusy, setImageBusy] = useState(false)

  const syncLinkUrl = useCallback(() => {
    if (!editor) return
    setLinkUrl(editor.getAttributes('link').href ?? '')
  }, [editor])

  if (!editor) return null

  const applyLink = () => {
    const url = linkUrl.trim()
    const saved = linkSelectionRef.current
    let chain = editor.chain().focus()
    if (saved) {
      chain = chain.setTextSelection(saved)
    }

    if (!url) {
      chain.extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      linkSelectionRef.current = null
      return
    }

    const href = normalizeMemoLinkHref(url)
    const empty = !saved || saved.from === saved.to
    if (empty) {
      chain
        .insertContent({
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run()
    } else {
      chain.setLink({ href }).run()
    }
    setLinkOpen(false)
    linkSelectionRef.current = null
  }

  return (
    <div
      className={cn(
        'tech-rise flex flex-wrap items-center gap-0.5 rounded-full bg-surface-secondary/70 p-1',
        className
      )}
    >
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label={t('editor.bold')}
      >
        <Bold className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label={t('editor.italic')}
      >
        <Italic className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label={t('editor.strike')}
      >
        <Strikethrough className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('code')}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label={t('editor.code')}
      >
        <Code className='size-4' />
      </Toggle>

      <span className={pillDividerClass} aria-hidden />

      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open)
          if (open) {
            const { from, to } = editor.state.selection
            linkSelectionRef.current = { from, to }
            syncLinkUrl()
          } else {
            linkSelectionRef.current = null
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={cn(
              pillButtonClass,
              editor.isActive('link') && 'bg-card text-primary shadow-sm'
            )}
            aria-label={t('editor.link')}
          >
            <Link2 />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-80 p-3' align='start'>
          <p className='mb-2 text-sm font-medium'>{t('editor.linkTitle')}</p>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder='https://'
            className='mb-2 h-9'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
            }}
          />
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => {
                editor.chain().focus().unsetLink().run()
                setLinkOpen(false)
              }}
            >
              {t('editor.linkRemove')}
            </Button>
            <Button type='button' size='sm' onClick={applyLink}>
              {t('editor.linkApply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type='button'
        variant='ghost'
        size='icon'
        className={pillButtonClass}
        disabled={imageBusy}
        aria-label={t('editor.image')}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus className='size-4' />
      </Button>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        className='hidden'
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (!files.length) return
          void (async () => {
            setImageBusy(true)
            try {
              await insertMemoImagesFromFiles(editor, files, fileshareFolderId)
            } catch {
              toast.error(t('editor.imageFailed'))
            } finally {
              setImageBusy(false)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }
          })()
        }}
      />

      <span className={pillDividerClass} aria-hidden />

      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('heading', { level: 1 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        aria-label='H1'
      >
        <Heading1 className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('heading', { level: 2 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        aria-label='H2'
      >
        <Heading2 className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('heading', { level: 3 })}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        aria-label='H3'
      >
        <Heading3 className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label={t('editor.bulletList')}
      >
        <List className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label={t('editor.orderedList')}
      >
        <ListOrdered className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label={t('editor.quote')}
      >
        <Quote className='size-4' />
      </Toggle>
      <Toggle
        size='sm'
        className={pillToggleClass}
        pressed={false}
        onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label={t('editor.divider')}
      >
        <Minus className='size-4' />
      </Toggle>
    </div>
  )
}
