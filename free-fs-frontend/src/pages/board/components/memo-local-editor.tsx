/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getMemoPreviewBody, saveMemoBody } from '@/api/workspace-board'
import { buildMemoEditorExtensions } from '@/lib/memo-editor-extensions'
import { reportImSaveFailed, useSaveImToWorkspace } from '@/hooks/use-save-im-to-workspace'
import { insertMemoImagesFromFiles, isImageFile, localFilesFromDataTransfer } from '@/lib/memo-insert-image'
import { INSERT_MEMO_LINKS_EVENT, insertMemoWikiLinks } from '@/lib/memo-wiki-link'
import { insertLocalFilesIntoMemo, insertMemoWorkspaceFileEmbeds } from '@/lib/memo-insert-workspace-file'
import { isMemoDrag } from '@/components/messages/im-drop-files'
import { acceptsMemoEditorDrop, applyMemoEditorDrop } from '@/lib/memo-editor-drop'
import { registerMemoFlush } from '@/lib/memo-editor-flush'
import { htmlFallbackToMd, memoJsonToMd, memoMdToJson } from '@/lib/memo-md'
import { MemoEditorToolbar } from '@/pages/board/components/memo-editor-toolbar'
import { MemoFormatChrome } from '@/pages/board/components/memo-format-menu'
import { cn } from '@/lib/utils'

type Props = {
  memoId: string
  className?: string
  fileshareFolderId?: string | null
  memosFolderId?: string | null
  workspaceSlug?: string
}

export function MemoLocalEditor({
  memoId,
  className,
  fileshareFolderId,
}: Props) {
  const { t } = useTranslation('board')
  const queryClient = useQueryClient()
  const { save: saveImToWorkspace } = useSaveImToWorkspace()
  const [empty, setEmpty] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [chatFileBusy, setChatFileBusy] = useState(false)
  const [serverChanged, setServerChanged] = useState(false)
  const dragDepthRef = useRef(0)
  const lastMd = useRef('')
  const readyRef = useRef(false)
  const memoDropHandledRef = useRef(false)
  const onEditorDropRef = useRef<(event: DragEvent) => boolean>(() => false)
  const contentEpochRef = useRef(0)

  const editor = useEditor({
    extensions: buildMemoEditorExtensions(),
    editorProps: {
      handleDrop: (_view, event) => onEditorDropRef.current(event),
      attributes: {
        class: cn(
          'memo-prose min-h-[12rem] px-1 py-2 focus:outline-none',
          'text-[14.5px] leading-[1.75] text-foreground',
          '[&_h1]:mt-1 [&_h1]:mb-2 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:tracking-[-0.022em]',
          '[&_h2]:mt-1 [&_h2]:mb-1.5 [&_h2]:text-[18px] [&_h2]:font-semibold',
          '[&_p]:my-2',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/40 [&_blockquote]:ps-3 [&_blockquote]:text-text-secondary',
          '[&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
          '[&_hr]:my-4 [&_hr]:border-border',
          '[&_.memo-image-node]:relative [&_.memo-image-node]:z-0'
        ),
      },
    },
    onCreate: ({ editor: ed }) => setEmpty(ed.isEmpty),
    onUpdate: ({ editor: ed }) => {
      setEmpty(ed.isEmpty)
    },
  })

  useEffect(() => {
    if (!editor) return
    ;(editor.storage as { memoImageMemoId?: string }).memoImageMemoId = memoId
  }, [editor, memoId])

  onEditorDropRef.current = (event) => {
    if (!editor || !isMemoDrag({ dataTransfer: event.dataTransfer })) return false
    event.preventDefault()
    memoDropHandledRef.current = true
    applyMemoEditorDrop(editor, event as DragEvent<HTMLDivElement>, {
      currentMemoId: memoId,
      onImages: () => undefined,
      onChatFile: () => undefined,
      onWorkspaceFail: () => undefined,
      onChatFail: () => undefined,
      onImageInvalid: () => undefined,
      onMemoFail: () => toast.error(t('editor.memoLinkFailed')),
    })
    return true
  }

  useEffect(() => {
    let active = true
    readyRef.current = false
    const epoch = contentEpochRef.current
    void getMemoPreviewBody(memoId)
      .then((body) => {
        if (!active || !editor || contentEpochRef.current !== epoch) return
        const md = (body.bodyMd || '').trim() || htmlFallbackToMd(body.bodyHtml || '')
        lastMd.current = md
        editor.commands.setContent(memoMdToJson(md), false)
        setEmpty(editor.isEmpty)
        readyRef.current = true
      })
      .catch(() => {
        if (active) {
          readyRef.current = true
          toast.error(t('preview.loadFailed'))
        }
      })
    return () => {
      active = false
    }
  }, [editor, memoId, t])

  const flush = useCallback(async () => {
    if (!editor || editor.isDestroyed || !readyRef.current) return
    const md = memoJsonToMd(editor.getJSON())
    lastMd.current = md
    const saved = await saveMemoBody(memoId, { bodyMd: md })
    queryClient.setQueryData(['memo-preview-body', memoId], saved)
  }, [editor, memoId, queryClient])

  useEffect(() => registerMemoFlush(memoId, flush), [flush, memoId])

  useEffect(() => {
    const onRemote = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string }>).detail
      if (detail?.memoId !== memoId) return
      setServerChanged(true)
    }
    window.addEventListener('alder:memo-server-changed', onRemote)
    return () => window.removeEventListener('alder:memo-server-changed', onRemote)
  }, [memoId])

  const handleInsertImages = useCallback(
    async (files: File[]) => {
      if (!editor || !files.length) return
      setImageBusy(true)
      try {
        await insertMemoImagesFromFiles(editor, files, fileshareFolderId)
      } catch {
        toast.error(t('editor.imageFailed'))
      } finally {
        setImageBusy(false)
        setDragOver(false)
        dragDepthRef.current = 0
      }
    },
    [editor, fileshareFolderId, t]
  )

  const handleInsertLocalFiles = useCallback(
    async (files: File[]) => {
      if (!editor || !files.length) return
      const others = files.filter((file) => !isImageFile(file))
      if (others.length && !fileshareFolderId) {
        toast.error(t('editor.chatFileNoFolder'))
        const images = files.filter(isImageFile)
        if (!images.length) return
        await handleInsertImages(images)
        return
      }
      setImageBusy(true)
      try {
        if (fileshareFolderId) {
          await insertLocalFilesIntoMemo(editor, files, fileshareFolderId)
        } else {
          await insertMemoImagesFromFiles(editor, files.filter(isImageFile), null)
        }
      } catch {
        toast.error(others.length ? t('editor.localFileFailed') : t('editor.imageFailed'))
      } finally {
        setImageBusy(false)
        setDragOver(false)
        dragDepthRef.current = 0
      }
    },
    [editor, fileshareFolderId, handleInsertImages, t]
  )

  useEffect(() => {
    const onInsert = (event: Event) => {
      const detail = (event as CustomEvent<{ targetMemoId?: string; memos?: { id: string; title?: string }[]; handled?: boolean }>).detail
      if (!editor || detail?.targetMemoId !== memoId || !detail.memos?.length) return
      if (!readyRef.current) return
      insertMemoWikiLinks(editor, detail.memos)
      detail.handled = true
    }
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string; bodyMd?: string }>).detail
      if (!editor || detail?.memoId !== memoId || detail.bodyMd == null) return
      contentEpochRef.current += 1
      lastMd.current = detail.bodyMd
      editor.commands.setContent(memoMdToJson(detail.bodyMd), false)
      setEmpty(editor.isEmpty)
      readyRef.current = true
    }
    window.addEventListener(INSERT_MEMO_LINKS_EVENT, onInsert)
    window.addEventListener('alder:memo-body-updated', onUpdated)
    return () => {
      window.removeEventListener(INSERT_MEMO_LINKS_EVENT, onInsert)
      window.removeEventListener('alder:memo-body-updated', onUpdated)
    }
  }, [editor, memoId])

  const handleInsertChatFile = useCallback(
    async (conversationId: string, messageId: number) => {
      if (!editor) {
        toast.error(t('editor.chatFileFailed'))
        return
      }
      if (!fileshareFolderId) {
        toast.error(t('editor.chatFileNoFolder'))
        return
      }
      setChatFileBusy(true)
      try {
        const saved = await saveImToWorkspace(
          { conversationId, messageId },
          fileshareFolderId
        )
        const name = (saved.displayName || saved.originalName || '').trim()
        if (!saved.id || !name) {
          toast.error(t('editor.chatFileFailed'))
          return
        }
        insertMemoWorkspaceFileEmbeds(editor, [
          {
            id: saved.id,
            name,
            size: saved.size ?? 0,
            mime: saved.mimeType,
            isDir: Boolean(saved.isDir),
            parentId: saved.parentId ?? fileshareFolderId,
          },
        ])
      } catch (cause) {
        reportImSaveFailed(cause, t('editor.chatFileFailed'))
      } finally {
        setChatFileBusy(false)
        setDragOver(false)
        dragDepthRef.current = 0
      }
    },
    [editor, fileshareFolderId, saveImToWorkspace, t]
  )

  const acceptsMemoDrop = acceptsMemoEditorDrop

  if (!editor) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        {t('editor.loading')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-[16px] border border-border/60 bg-card px-3.5 py-3 shadow-xs',
        className
      )}
    >
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        {serverChanged ? (
          <p
            role='status'
            className='rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[12.5px] leading-snug text-foreground'
          >
            {t('editor.remoteOverwrite')}
          </p>
        ) : null}
        <MemoEditorToolbar editor={editor} fileshareFolderId={fileshareFolderId} />
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[13px] transition-colors',
            dragOver && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background'
          )}
          onDragEnter={(e) => {
            if (!acceptsMemoDrop(e.dataTransfer.types)) return
            e.preventDefault()
            dragDepthRef.current += 1
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            if (!acceptsMemoDrop(e.dataTransfer.types)) return
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
            if (dragDepthRef.current === 0) setDragOver(false)
          }}
          onDragOver={(e) => {
            if (!acceptsMemoDrop(e.dataTransfer.types)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            e.preventDefault()
            e.stopPropagation()
            dragDepthRef.current = 0
            setDragOver(false)
            if (memoDropHandledRef.current) {
              memoDropHandledRef.current = false
              return
            }
            applyMemoEditorDrop(editor, e, {
              currentMemoId: memoId,
              onImages: (files) => void handleInsertImages(files),
              onLocalFiles: (files) => void handleInsertLocalFiles(files),
              onChatFile: (conversationId, messageId) =>
                void handleInsertChatFile(conversationId, messageId),
              onWorkspaceFail: () => toast.error(t('editor.workspaceFileFailed')),
              onChatFail: () => toast.error(t('editor.chatFileFailed')),
              onImageInvalid: () => toast.error(t('editor.imageDropInvalid')),
              onMemoFail: () => toast.error(t('editor.memoLinkFailed')),
            })
          }}
          onPaste={(event) => {
            const files = localFilesFromDataTransfer(event.clipboardData)
            if (!files.length) return
            event.preventDefault()
            void handleInsertLocalFiles(files)
          }}
        >
          {empty ? (
            <p
              className='pointer-events-none absolute inset-x-1 top-2 text-[14.5px] leading-relaxed text-text-muted'
              aria-hidden
            >
              {t('editor.placeholder')}
            </p>
          ) : null}
          {imageBusy || chatFileBusy ? (
            <p className='absolute top-2 right-2 z-10 rounded-full bg-surface-secondary px-2.5 py-1 font-mono text-[11px] tracking-wider text-text-muted'>
              {chatFileBusy ? t('editor.chatFileSaving') : t('editor.imageUploading')}
            </p>
          ) : null}
          <MemoFormatChrome editor={editor}>
            <div className='memo-editor-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden'>
              <EditorContent editor={editor} />
            </div>
          </MemoFormatChrome>
        </div>
      </div>
    </div>
  )
}
