/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react'
import { EditorContent, useEditor } from '@tiptap/react'
import { useQuery } from '@tanstack/react-query'
import { createContext, lazy, Suspense, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMemoPreviewBody } from '@/api/workspace-board'
import { FileIcon } from '@/components/file-icon'
import { MemoAuthenticatedImage } from '@/components/memo-authenticated-image'
import { CANVAS_COLORS, canvasColorCss, normalizeCanvasText } from '@/lib/memo-canvas'
import { buildMemoEditorExtensions } from '@/lib/memo-editor-extensions'
import { htmlFallbackToMd, memoJsonToMd, memoMdToJson } from '@/lib/memo-md'
import { openMemoById } from '@/lib/memo-wiki-link'
import { MemoFormatChrome } from '@/pages/board/components/memo-format-menu'
import type { FileItem } from '@/types/file'
import { formatFileSize } from '@/utils/format'
import { isImagePreviewSuffix, openFilePreview } from '@/utils/preview'
import { MemoMarkdownView } from '@/pages/board/components/memo-markdown-view'
import { cn } from '@/lib/utils'

const NestedCanvas = lazy(() =>
  import('@/pages/board/components/memo-canvas-view').then((mod) => ({ default: mod.MemoCanvasView }))
)

export const CanvasEmbedTrail = createContext<string[]>([])

type ToolbarActions = {
  onColor?: (color?: string) => void
  onDelete?: () => void
  onConvert?: () => void
  onFit?: () => void
  onDirty?: () => void
}

export const CanvasCardActions = createContext<ToolbarActions>({})

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const

function Ports() {
  return (
    <>
      {SIDES.map((pos) => (
        <Handle key={pos} type='source' position={pos} id={pos} />
      ))}
      {SIDES.map((pos) => (
        <Handle key={`t-${pos}`} type='target' position={pos} id={`t-${pos}`} />
      ))}
    </>
  )
}

function CardChrome({
  selected,
  color,
  children,
  className,
  convert,
}: {
  selected?: boolean
  color?: string
  children: React.ReactNode
  className?: string
  convert?: boolean
}) {
  const { t } = useTranslation('board')
  const actions = useContext(CanvasCardActions)
  return (
    <div
      className={cn('memo-card-shell', className)}
      data-color={color || undefined}
      style={color ? { '--mc-color': canvasColorCss(color) } as React.CSSProperties : undefined}
    >
      <Ports />
      <NodeResizer
        minWidth={160}
        minHeight={80}
        isVisible={Boolean(selected)}
        onResizeEnd={() => actions.onDirty?.()}
      />
      <div className={cn('memo-card', selected && 'selected')} data-color={color || undefined}>
      {selected ? (
        <NodeToolbar isVisible position={Position.Top} className='memo-card-toolbar' offset={8}>
          {CANVAS_COLORS.map((item) => (
            <button
              key={item.id}
              type='button'
              className='memo-swatch'
              style={{ background: item.css }}
              onClick={() => actions.onColor?.(item.id)}
            />
          ))}
          <button type='button' onClick={() => actions.onColor?.(undefined)}>
            {t('canvas.clearColor')}
          </button>
          {convert ? (
            <button type='button' onClick={() => actions.onConvert?.()}>
              {t('canvas.convertNote')}
            </button>
          ) : null}
          <button type='button' onClick={() => actions.onFit?.()}>
            {t('canvas.zoomSelection')}
          </button>
          <button type='button' onClick={() => actions.onDelete?.()}>
            {t('deleteMemo')}
          </button>
        </NodeToolbar>
      ) : null}
      {children}
      </div>
    </div>
  )
}

function TextCardEditor({
  text,
  onChange,
}: {
  text: string
  onChange: (md: string) => void
}) {
  const incoming = normalizeCanvasText(text)
  const editor = useEditor({
    extensions: buildMemoEditorExtensions(),
    content: memoMdToJson(incoming),
    editorProps: {
      attributes: {
        class: 'memo-card__editor nodrag nopan nowheel',
      },
    },
    onUpdate: ({ editor: next }) => {
      onChange(memoJsonToMd(next.getJSON()))
    },
  })
  useEffect(() => {
    if (!editor) return
    const current = memoJsonToMd(editor.getJSON())
    if (current.trim() === incoming.trim()) return
    editor.commands.setContent(memoMdToJson(incoming), false)
  }, [editor, incoming])
  return (
    <MemoFormatChrome editor={editor}>
      <EditorContent
        editor={editor}
        className='nodrag nopan nowheel min-h-0 flex-1'
        onPointerDown={(event) => event.stopPropagation()}
      />
    </MemoFormatChrome>
  )
}

export function TextCardNode({ data, selected }: NodeProps) {
  const actions = useContext(CanvasCardActions)
  return (
    <CardChrome selected={selected} color={String(data?.color || '')} convert>
      <div className='memo-card__grip' />
      <TextCardEditor
        text={String(data?.text || '')}
        onChange={(md) => {
          data.text = md
          actions.onDirty?.()
        }}
      />
    </CardChrome>
  )
}

export function FileCardNode({ data, selected }: NodeProps) {
  const { t } = useTranslation('board')
  const trail = useContext(CanvasEmbedTrail)
  const memoId = String(data?.memoId || '')
  const fileId = String(data?.fileId || '')
  const title = String(data?.title || data?.label || t('defaultMemoTitle'))
  const kind = String(data?.kind || 'md')
  const suffix = String(
    data?.suffix || (title.includes('.') ? title.split('.').pop() : '') || ''
  ).toLowerCase()
  const size = Number(data?.size) || 0
  const isDir = data?.isDir === true
  const cycle = Boolean(memoId && trail.includes(memoId))
  const tooDeep = trail.length >= 3
  if (!memoId && fileId && (kind === 'image' || isImagePreviewSuffix(suffix))) {
    return (
      <CardChrome selected={selected} color={String(data?.color || '')}>
        <div
          className='memo-card__media'
          onDoubleClick={(event) => {
            event.stopPropagation()
            if (!fileId) return
            openFilePreview({
              id: fileId,
              displayName: title,
              suffix: suffix || 'png',
              isDir: false,
            } as FileItem)
          }}
        >
          {fileId ? <MemoAuthenticatedImage fileId={fileId} alt={title} className='h-full w-full object-contain' /> : null}
        </div>
      </CardChrome>
    )
  }
  if (!memoId) {
    return (
      <CardChrome selected={selected} color={String(data?.color || '')}>
        <button
          type='button'
          className='memo-card__file-ref'
          onDoubleClick={(event) => {
            event.stopPropagation()
            if (isDir) return
            openFilePreview({
              id: fileId,
              displayName: title,
              suffix,
              isDir,
              size,
              mimeType: String(data?.mime || ''),
            } as FileItem)
          }}
        >
          <FileIcon type={isDir ? 'folder' : suffix || 'default'} size={36} />
          <span className='memo-card__file-ref-meta'>
            <span className='memo-card__file-ref-name'>{title}</span>
            <span className='memo-card__file-ref-size'>
              {isDir ? t('canvas.folderRef') : size > 0 ? formatFileSize(size) : t('canvas.fileRef')}
            </span>
          </span>
        </button>
      </CardChrome>
    )
  }
  return (
    <CardChrome selected={selected} color={String(data?.color || '')}>
      <div
        className='memo-card__bar'
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (memoId) openMemoById(memoId, title)
        }}
      >
        <span className='min-w-0 flex-1 truncate'>{title}</span>
      </div>
      <div className='memo-card__body'>
        {!memoId || cycle || tooDeep ? (
          <div className='memo-embed__cycle'>
            {cycle || tooDeep ? t('canvas.embedCycle') : t('editor.memoLinkMissing')}
          </div>
        ) : kind === 'canvas' ? (
          <Suspense fallback={<div className='memo-embed__gone'>…</div>}>
            <NestedCanvas memoId={memoId} readOnly ancestors={[...trail, memoId]} nested />
          </Suspense>
        ) : (
          <EmbedMarkdown memoId={memoId} />
        )}
      </div>
    </CardChrome>
  )
}

export function LinkCardNode({ data, selected }: NodeProps) {
  const [live, setLive] = useState(false)
  const url = String(data?.url || '')
  useEffect(() => {
    if (!selected) setLive(false)
  }, [selected])
  return (
    <CardChrome selected={selected} color={String(data?.color || '')}>
      <div className='memo-card__bar'>
        <a className='min-w-0 truncate nodrag' href={url} target='_blank' rel='noreferrer' onPointerDown={(e) => e.stopPropagation()}>
          {url}
        </a>
      </div>
      <div className={cn('memo-card__media', live && 'is-live')}>
        {url ? (
          <iframe
            className='memo-card__frame'
            src={url}
            title={url}
            sandbox='allow-scripts allow-same-origin allow-popups allow-forms'
          />
        ) : null}
        {!live ? (
          <div
            className='memo-card__web-shield'
            onDoubleClick={(event) => {
              event.stopPropagation()
              setLive(true)
            }}
          />
        ) : null}
      </div>
    </CardChrome>
  )
}

export function GroupCardNode({ data, selected }: NodeProps) {
  const actions = useContext(CanvasCardActions)
  const color = String(data?.color || '')
  return (
    <div
      className='memo-group'
      data-color={color || undefined}
      style={color ? { '--mc-color': canvasColorCss(color) } as React.CSSProperties : undefined}
    >
      <NodeResizer
        minWidth={220}
        minHeight={140}
        isVisible={Boolean(selected)}
        onResizeEnd={() => actions.onDirty?.()}
      />
      <input
        className='nodrag nopan'
        defaultValue={String(data?.label || data?.title || 'Group')}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          data.label = event.target.value
          data.title = event.target.value
        }}
        onBlur={(event) => {
          data.label = event.target.value
          data.title = event.target.value
          actions.onDirty?.()
        }}
      />
    </div>
  )
}

function EmbedMarkdown({ memoId }: { memoId: string }) {
  const { t } = useTranslation('board')
  const body = useQuery({
    queryKey: ['memo-preview-body', memoId],
    queryFn: () => getMemoPreviewBody(memoId),
    staleTime: 30_000,
  })
  const markdown =
    (body.data?.bodyMd || '').trim() || htmlFallbackToMd(body.data?.bodyHtml || '')
  if (body.isError) return <div className='memo-embed__gone'>{t('preview.loadFailed')}</div>
  if (!markdown) return <div className='memo-embed__gone'>{t('preview.empty')}</div>
  return <MemoMarkdownView markdown={markdown} memoId={memoId} />
}

export function CanvasBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  style,
  label,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow()
  const actions = useContext(CanvasCardActions)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(label || ''))
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const commit = (value: string) => {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === id ? { ...edge, label: value, data: { ...edge.data, label: value } } : edge
      )
    )
    actions.onDirty?.()
    setEditing(false)
  }
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} markerStart={markerStart} style={style} />
      <EdgeLabelRenderer>
        <div
          className='memo-edge-label nodrag nopan'
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            setDraft(String(label || ''))
            setEditing(true)
          }}
        >
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => commit(draft.trim())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit(draft.trim())
                if (event.key === 'Escape') setEditing(false)
              }}
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span data-empty={!label && !selected ? '1' : undefined}>{label || (selected ? '…' : '')}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const canvasNodeTypes = {
  text: TextCardNode,
  file: FileCardNode,
  link: LinkCardNode,
  group: GroupCardNode,
}

export const canvasEdgeTypes = {
  canvas: CanvasBezierEdge,
  default: CanvasBezierEdge,
}
