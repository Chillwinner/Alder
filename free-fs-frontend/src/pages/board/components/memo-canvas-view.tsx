/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectEnd,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Globe, ImageIcon, Minus, Plus, RotateCcw, SquareStack } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createWorkspaceMemo,
  getMemoCanvas,
  getWorkspaceBoardOverview,
  lookupMemoByFileId,
  saveMemoBody,
  saveMemoCanvas,
} from '@/api/workspace-board'
import {
  collectMemoDrag,
  collectWorkspaceFileDrag,
  isMemoDrag,
  isWorkspaceFileDrag,
} from '@/components/messages/im-drop-files'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  fromFlowGraph,
  newFileNode,
  newGroupNode,
  newImageNode,
  newLinkNode,
  newWorkspaceFileNode,
  newTextNode,
  parseCanvasDocument,
  toFlowGraph,
  type EdgeEnds,
} from '@/lib/memo-canvas'
import { registerMemoFlush } from '@/lib/memo-editor-flush'
import { cn } from '@/lib/utils'
import { isImagePreviewSuffix } from '@/utils/preview'
import {
  CanvasCardActions,
  CanvasEmbedTrail,
  canvasEdgeTypes,
  canvasNodeTypes,
} from '@/pages/board/components/memo-canvas-nodes'
import '@/pages/board/memo-canvas.css'

type Props = {
  memoId?: string
  document?: string
  readOnly?: boolean
  nested?: boolean
  ancestors?: string[]
  className?: string
  visibility?: string
}

export function MemoCanvasView(props: Props) {
  return (
    <ReactFlowProvider>
      <MemoCanvasFlow {...props} />
    </ReactFlowProvider>
  )
}

function MemoCanvasFlow({
  memoId = '',
  document: incoming,
  readOnly,
  nested,
  ancestors = [],
  className,
  visibility,
}: Props) {
  const { t } = useTranslation('board')
  const flow = useReactFlow()
  const queryClient = useQueryClient()
  const locked = Boolean(readOnly || !memoId || incoming != null)
  const trail = useMemo(
    () => (ancestors.includes(memoId) ? ancestors : [...ancestors, memoId]),
    [ancestors, memoId]
  )
  const query = useQuery({
    queryKey: ['memo-canvas', memoId],
    queryFn: () => getMemoCanvas(memoId),
    enabled: Boolean(memoId) && incoming == null,
    staleTime: 15_000,
  })
  const parsed = toFlowGraph(parseCanvasDocument(incoming ?? query.data?.document))
  const [nodes, setNodes, onNodesChange] = useNodesState(parsed.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(parsed.edges)
  const viewport = useRef<Viewport>(parsed.viewport ?? { x: 0, y: 0, zoom: 1 })
  const loaded = useRef('')
  const [picker, setPicker] = useState<{
    mode: 'note' | 'image' | 'link'
    x: number
    y: number
    connect?: Connection | null
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [serverChanged, setServerChanged] = useState(false)
  const hydrated = useRef(false)

  useEffect(() => {
    loaded.current = ''
    hydrated.current = false
    setServerChanged(false)
  }, [memoId])

  useEffect(() => {
    const raw = incoming ?? query.data?.document
    if (!raw) return
    if (!locked && hydrated.current) return
    if (loaded.current === raw) {
      hydrated.current = true
      return
    }
    loaded.current = raw
    const next = toFlowGraph(parseCanvasDocument(raw))
    setNodes(next.nodes)
    setEdges(next.edges)
    if (next.viewport) {
      viewport.current = next.viewport
      flow.setViewport(next.viewport)
    }
    hydrated.current = true
  }, [flow, incoming, locked, query.data?.document, setEdges, setNodes])
  const persistTimer = useRef(0)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges
  const saveNow = useCallback(
    (nextNodes?: Node[], nextEdges?: Edge[], nextViewport?: Viewport) => {
      if (locked) return
      if (nextNodes) nodesRef.current = nextNodes
      if (nextEdges) edgesRef.current = nextEdges
      if (nextViewport) viewport.current = nextViewport
    },
    [locked]
  )
  const flush = useCallback(async () => {
    if (locked || !hydrated.current) return
    const document = fromFlowGraph(
      flow.getNodes?.() ?? nodesRef.current,
      flow.getEdges?.() ?? edgesRef.current,
      viewport.current
    )
    loaded.current = document
    await saveMemoCanvas(memoId, document)
    queryClient.setQueryData(['memo-canvas', memoId], { memoId, document })
  }, [flow, locked, memoId, queryClient])
  useEffect(() => {
    if (locked || !memoId) return undefined
    return registerMemoFlush(memoId, flush)
  }, [flush, locked, memoId])
  useEffect(() => {
    const onRemote = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string }>).detail
      if (locked || detail?.memoId !== memoId) return
      setServerChanged(true)
    }
    window.addEventListener('alder:memo-server-changed', onRemote)
    return () => window.removeEventListener('alder:memo-server-changed', onRemote)
  }, [locked, memoId])
  const saveNowRef = useRef(saveNow)
  saveNowRef.current = saveNow
  const scheduleSave = useCallback(
    (nextNodes?: Node[], nextEdges?: Edge[], nextViewport?: Viewport) => {
      if (locked) return
      window.clearTimeout(persistTimer.current)
      persistTimer.current = window.setTimeout(() => saveNow(nextNodes, nextEdges, nextViewport), 400)
    },
    [locked, saveNow]
  )
  const addNodes = (added: Node[]) => {
    setNodes((current) => {
      const next = [...current, ...added]
      scheduleSave(next, flow.getEdges())
      return next
    })
  }

  const addText = (point: { x: number; y: number }, connect?: Connection | null) => {
    const node = newTextNode(point)
    addNodes([node])
    if (connect) finishConnect(connect, node.id)
    setPicker(null)
  }

  const finishConnect = (connection: Connection, targetId: string) => {
    setEdges((current) => {
      const next = addEdge(
        {
          ...connection,
          target: targetId,
          type: 'canvas',
          markerStart: { type: MarkerType.ArrowClosed },
          data: { fromEnd: 'none', toEnd: 'arrow', label: '' },
        },
        current
      )
      scheduleSave(flow.getNodes(), next)
      return next
    })
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const next = addEdge(
          {
            ...connection,
            type: 'canvas',
            markerStart: { type: MarkerType.ArrowClosed },
            data: { fromEnd: 'none', toEnd: 'arrow', label: '' },
          },
          current
        )
        scheduleSave(undefined, next)
        return next
      })
    },
    [scheduleSave, setEdges]
  )

  const onConnectEnd: OnConnectEnd = (_event, state) => {
    if (locked || state.toNode) return
    const event = _event as MouseEvent
    const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setPicker({
      mode: 'note',
      x: event.clientX,
      y: event.clientY,
      connect: {
        source: state.fromNode?.id || '',
        sourceHandle: state.fromHandle?.id || 'right',
        target: '',
        targetHandle: 't-left',
      },
    })
    void point
  }

  const dropMemo = async (event: React.DragEvent) => {
    if (locked) return
    const fromMemos = isMemoDrag(event)
    const fromFiles = isWorkspaceFileDrag(event)
    if (!fromMemos && !fromFiles) return
    event.preventDefault()
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const dropped = fromMemos
      ? collectMemoDrag(event).filter((item) => item.id && item.id !== memoId)
      : []
    const files: {
      id: string
      displayName: string
      suffix: string
      size?: number
      mime?: string
      isDir?: boolean
    }[] = []
    if (fromFiles) {
      for (const file of collectWorkspaceFileDrag(event).files) {
        const suffix = (file.name.split('.').pop() || '').toLowerCase()
        const asFile = {
          id: file.id,
          displayName: file.name,
          suffix,
          size: file.size,
          mime: file.mime || '',
          isDir: file.isDir,
        }
        try {
          const memo = await lookupMemoByFileId(file.id)
          if (memo?.id && memo.id !== memoId) dropped.push(memo)
          else files.push(asFile)
        } catch {
          files.push(asFile)
        }
      }
    }
    const added = [
      ...dropped.map((memo, index) =>
        newFileNode(memo, { x: position.x + index * 24, y: position.y + index * 24 })
      ),
      ...files.map((file, index) =>
        newWorkspaceFileNode(file, {
          x: position.x + (dropped.length + index) * 24,
          y: position.y + (dropped.length + index) * 24,
        })
      ),
    ]
    if (!added.length) return
    addNodes(added)
  }

  const patchSelected = (fn: (node: Node) => Node) => {
    setNodes((current) => {
      const next = current.map((node) => (node.selected ? fn(node) : node))
      scheduleSave(next)
      return next
    })
  }

  const convertSelected = async () => {
    const selected = flow.getNodes().find((node) => node.selected && node.type === 'text')
    if (!selected) return
    const text = String(selected.data?.text || '')
    const title = text.split('\n')[0]?.trim() || t('defaultMemoTitle')
    const memo = await createWorkspaceMemo(
      title,
      visibility === 'shared' ? 'shared' : 'private',
      'md'
    )
    if (text) await saveMemoBody(memo.id, { bodyMd: text })
    setNodes((current) => {
      const next = current.map((node) =>
        node.id === selected.id
          ? newFileNode(memo, node.position)
          : node
      )
      scheduleSave(next)
      return next
    })
  }

  const groupSelected = () => {
    const selected = flow.getNodes().filter((node) => node.selected && node.type !== 'group')
    if (!selected.length) {
      const center = flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      addNodes([newGroupNode({ x: center.x - 160, y: center.y - 80 })])
      return
    }
    const xs = selected.map((n) => n.position.x)
    const ys = selected.map((n) => n.position.y)
    const x = Math.min(...xs) - 24
    const y = Math.min(...ys) - 40
    const width = Math.max(...selected.map((n) => n.position.x + Number(n.style?.width ?? 260))) - x + 24
    const height = Math.max(...selected.map((n) => n.position.y + Number(n.style?.height ?? 140))) - y + 24
    addNodes([newGroupNode({ x, y }, { width, height })])
  }

  const patchEdge = (id: string, patch: Record<string, unknown>) => {
    setEdges((current) => {
      const next = current.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              label: (patch.label as string) ?? edge.label,
              data: { ...edge.data, ...patch },
              markerStart:
                patch.toEnd === 'arrow'
                  ? { type: MarkerType.ArrowClosed }
                  : patch.toEnd === 'none'
                    ? undefined
                    : edge.markerStart,
              markerEnd:
                patch.fromEnd === 'arrow'
                  ? { type: MarkerType.ArrowClosed }
                  : patch.fromEnd === 'none'
                    ? undefined
                    : edge.markerEnd,
            }
          : edge
      )
      scheduleSave(undefined, next)
      return next
    })
  }

  return (
    <CanvasEmbedTrail.Provider value={trail}>
      <CanvasCardActions.Provider
        value={{
          onColor: (color) => patchSelected((node) => ({ ...node, data: { ...node.data, color } })),
          onDelete: () =>
            setNodes((current) => {
              const next = current.filter((node) => !node.selected)
              scheduleSave(next)
              return next
            }),
          onConvert: () => void convertSelected(),
          onFit: () => flow.fitView({ nodes: flow.getNodes().filter((n) => n.selected), padding: 0.3 }),
          onDirty: () => scheduleSave(),
        }}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={locked || nested}>
            <div
              data-memo-canvas={memoId}
              className={cn('memo-canvas', className)}
              onDragOver={(event) => {
                if (!locked && (isMemoDrag(event) || isWorkspaceFileDrag(event))) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={dropMemo}
              onDoubleClick={(event) => {
                if (locked) return
                const target = event.target as HTMLElement
                if (target.closest('.react-flow__node, textarea, input, a, button')) return
                addText(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
              }}
              onPaste={(event) => {
                if (locked) return
                const text = event.clipboardData.getData('text/plain').trim()
                if (!/^https?:\/\//.test(text)) return
                event.preventDefault()
                addNodes([newLinkNode(flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }), text)])
              }}
            >
              {serverChanged && !locked ? (
                <p
                  role='status'
                  className='absolute top-3 left-3 z-10 max-w-sm rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-[12.5px] leading-snug text-foreground'
                >
                  {t('editor.remoteOverwrite')}
                </p>
              ) : null}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={canvasNodeTypes}
                edgeTypes={canvasEdgeTypes}
                connectionMode={ConnectionMode.Loose}
                connectionLineType={ConnectionLineType.Bezier}
                defaultEdgeOptions={{
                  type: 'canvas',
                  markerStart: { type: MarkerType.ArrowClosed },
                }}
                onNodesChange={(changes) => {
                  onNodesChange(changes)
                  if (locked) return
                  const dragEnded = changes.some((change) => change.type === 'position' && change.dragging === false)
                  const resizeEnded = changes.some(
                    (change) => change.type === 'dimensions' && 'resizing' in change && change.resizing === false
                  )
                  if (dragEnded || resizeEnded) {
                    window.setTimeout(() => {
                      const next = (flow.getNodes() ?? nodesRef.current).map((node) => ({
                        ...node,
                        style: {
                          ...node.style,
                          width: node.width ?? node.style?.width,
                          height: node.height ?? node.style?.height,
                        },
                      }))
                      setNodes(next)
                      saveNowRef.current(next)
                    }, 0)
                    return
                  }
                  if (changes.some((change) => change.type === 'position' || change.type === 'dimensions')) {
                    return
                  }
                  scheduleSave()
                }}
                onEdgesChange={(changes) => {
                  onEdgesChange(changes)
                  if (!locked) scheduleSave()
                }}
                onConnect={locked ? undefined : onConnect}
                onConnectEnd={locked ? undefined : onConnectEnd}
                onEdgeContextMenu={(event, edge) => {
                  if (locked) return
                  event.preventDefault()
                  const choice = window.prompt(t('canvas.edgeDirection'), String((edge.data?.toEnd as EdgeEnds) || 'arrow'))
                  if (choice === 'none' || choice === 'arrow') patchEdge(edge.id, { toEnd: choice, fromEnd: 'none' })
                  if (choice === 'both') patchEdge(edge.id, { toEnd: 'arrow', fromEnd: 'arrow' })
                }}
                onMoveEnd={(_e, next) => {
                  viewport.current = next
                  setZoom(next.zoom)
                  if (!locked) scheduleSave(undefined, undefined, next)
                }}
                nodesDraggable={!locked}
                nodeDragThreshold={5}
                nodesConnectable={!locked}
                elementsSelectable
                selectionOnDrag={false}
                selectionKeyCode='Shift'
                panOnDrag
                zoomOnScroll
                defaultViewport={parsed.viewport}
                proOptions={{ hideAttribution: true }}
                fitView={nested}
                minZoom={0.15}
                maxZoom={2}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
              </ReactFlow>
              {!nested ? (
                <CanvasZoom
                  zoom={zoom}
                  onIn={() => void flow.zoomIn({ duration: 120 })}
                  onOut={() => void flow.zoomOut({ duration: 120 })}
                  onReset={() => void flow.fitView({ padding: 0.2, duration: 200 })}
                />
              ) : null}
              {!locked && !nested ? (
                <CanvasDock
                  onCard={() =>
                    addText(flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
                  }
                  onNote={() =>
                    setPicker({
                      mode: 'note',
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                    })
                  }
                  onImage={() =>
                    setPicker({
                      mode: 'image',
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                    })
                  }
                  onWeb={() =>
                    setPicker({
                      mode: 'link',
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                    })
                  }
                />
              ) : null}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => addText(flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))}>
              {t('canvas.newText')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setPicker({ mode: 'note', x: window.innerWidth / 2, y: window.innerHeight / 2 })}>
              {t('canvas.newNote')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setPicker({ mode: 'image', x: window.innerWidth / 2, y: window.innerHeight / 2 })}>
              {t('canvas.newImage')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setPicker({ mode: 'link', x: window.innerWidth / 2, y: window.innerHeight / 2 })}>
              {t('canvas.newWeb')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={groupSelected}>{t('canvas.newGroup')}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {picker ? (
          <InsertPicker
            mode={picker.mode}
            excludeId={memoId}
            allowText={Boolean(picker.connect)}
            onClose={() => setPicker(null)}
            onText={() => addText(flow.screenToFlowPosition({ x: picker.x, y: picker.y }), picker.connect)}
            onPickNote={(memo) => {
              const point = flow.screenToFlowPosition({ x: picker.x, y: picker.y })
              const node = newFileNode(memo, point)
              addNodes([node])
              if (picker.connect) finishConnect(picker.connect, node.id)
              setPicker(null)
            }}
            onPickImage={(file) => {
              addNodes([newImageNode(file, flow.screenToFlowPosition({ x: picker.x, y: picker.y }))])
              setPicker(null)
            }}
            onPickLink={(url) => {
              addNodes([newLinkNode(flow.screenToFlowPosition({ x: picker.x, y: picker.y }), url)])
              setPicker(null)
            }}
          />
        ) : null}
      </CanvasCardActions.Provider>
    </CanvasEmbedTrail.Provider>
  )
}

function CanvasDock({
  onCard,
  onNote,
  onImage,
  onWeb,
}: {
  onCard: () => void
  onNote: () => void
  onImage: () => void
  onWeb: () => void
}) {
  const { t } = useTranslation('board')
  return (
    <div className='memo-canvas-dock'>
      <button type='button' aria-label={t('canvas.newText')} title={t('canvas.newText')} onClick={onCard}>
        <SquareStack className='size-4' />
      </button>
      <button type='button' aria-label={t('canvas.newNote')} title={t('canvas.newNote')} onClick={onNote}>
        <FileText className='size-4' />
      </button>
      <button type='button' aria-label={t('canvas.newImage')} title={t('canvas.newImage')} onClick={onImage}>
        <ImageIcon className='size-4' />
      </button>
      <button type='button' aria-label={t('canvas.newWeb')} title={t('canvas.newWeb')} onClick={onWeb}>
        <Globe className='size-4' />
      </button>
    </div>
  )
}

function CanvasZoom({
  zoom,
  onIn,
  onOut,
  onReset,
}: {
  zoom: number
  onIn: () => void
  onOut: () => void
  onReset: () => void
}) {
  const { t } = useTranslation('board')
  return (
    <div className='memo-canvas-zoom'>
      <button type='button' aria-label={t('canvas.zoomIn')} title={t('canvas.zoomIn')} onClick={onIn}>
        <Plus className='size-4' />
      </button>
      <button type='button' aria-label={t('canvas.zoomOut')} title={t('canvas.zoomOut')} onClick={onOut}>
        <Minus className='size-4' />
      </button>
      <button type='button' aria-label={t('canvas.zoomReset')} title={t('canvas.fit')} onClick={onReset}>
        <RotateCcw className='size-4' />
      </button>
      <span>{Math.round(zoom * 100)}%</span>
    </div>
  )
}

function InsertPicker({
  mode,
  excludeId,
  allowText,
  onPickNote,
  onPickImage,
  onPickLink,
  onText,
  onClose,
}: {
  mode: 'note' | 'image' | 'link'
  excludeId: string
  allowText?: boolean
  onPickNote: (memo: { id: string; title: string; kind?: string }) => void
  onPickImage: (file: { id: string; displayName: string; suffix?: string }) => void
  onPickLink: (url: string) => void
  onText: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('board')
  const [q, setQ] = useState(mode === 'link' ? 'https://' : '')
  const list = useQuery({
    queryKey: ['workspace-board-picker'],
    queryFn: getWorkspaceBoardOverview,
    staleTime: 10_000,
    enabled: mode !== 'link',
  })
  const query = q.trim().toLowerCase()
  const memos = (list.data?.memos ?? []).filter(
    (item) => item.id !== excludeId && (!query || item.title.toLowerCase().includes(query))
  )
  const images = (list.data?.fileshareFiles ?? []).filter(
    (file) =>
      !file.isDir &&
      isImagePreviewSuffix(file.suffix || '') &&
      (!query || file.displayName.toLowerCase().includes(query))
  )
  const items = mode === 'note' ? memos : images
  const submitLink = () => {
    const url = q.trim()
    if (!/^https?:\/\//i.test(url)) return
    onPickLink(url)
  }
  return (
    <div className='memo-canvas-picker' onClick={onClose} role='presentation'>
      <div
        className='memo-canvas-picker__panel'
        role='dialog'
        aria-label={mode === 'note' ? t('canvas.pickNote') : mode === 'image' ? t('canvas.pickImage') : t('canvas.pickWeb')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className='memo-canvas-picker__head'>
          <h3>{mode === 'note' ? t('canvas.pickNote') : mode === 'image' ? t('canvas.pickImage') : t('canvas.pickWeb')}</h3>
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (mode === 'link' && event.key === 'Enter') submitLink()
            }}
            placeholder={
              mode === 'note' ? t('canvas.searchNotes') : mode === 'image' ? t('canvas.searchImages') : t('canvas.webUrl')
            }
          />
        </div>
        {mode === 'link' ? (
          <div className='memo-canvas-picker__list'>
            <button type='button' onClick={submitLink}>
              {t('canvas.newWeb')}
            </button>
          </div>
        ) : (
          <div className='memo-canvas-picker__list'>
            {allowText && mode === 'note' ? (
              <button type='button' onClick={onText}>
                {t('canvas.newText')}
              </button>
            ) : null}
            {mode === 'note'
              ? memos.map((memo) => (
                  <button key={memo.id} type='button' onClick={() => onPickNote(memo)}>
                    {memo.title}
                  </button>
                ))
              : images.map((file) => (
                  <button key={file.id} type='button' onClick={() => onPickImage(file)}>
                    {file.displayName}
                  </button>
                ))}
            {!items.length ? (
              <div className='memo-canvas-picker__empty'>
                {mode === 'note' ? t('canvas.emptyNotes') : t('canvas.emptyImages')}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
