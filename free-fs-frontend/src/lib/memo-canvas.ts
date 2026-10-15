/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { Edge, Node } from '@xyflow/react'
import { MarkerType, Position } from '@xyflow/react'
import type { MemoKind, WorkspaceMemo } from '@/types/workspace-board'

export type CanvasSide = 'top' | 'right' | 'bottom' | 'left'
export type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6'
export type EdgeEnds = 'none' | 'arrow'

export type JsonCanvasNode = {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  x: number
  y: number
  width: number
  height: number
  color?: string
  text?: string
  file?: string
  url?: string
  label?: string
  memoId?: string
  kind?: MemoKind | string
  fileId?: string
  suffix?: string
  size?: number
  mime?: string
  isDir?: boolean
}

export type JsonCanvasEdge = {
  id: string
  fromNode: string
  fromSide?: CanvasSide
  toNode: string
  toSide?: CanvasSide
  label?: string
  color?: string
  fromEnd?: EdgeEnds
  toEnd?: EdgeEnds
}

export type MemoCanvasDocument = {
  nodes: JsonCanvasNode[]
  edges: JsonCanvasEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export const EMPTY_CANVAS: MemoCanvasDocument = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
}

export const CANVAS_COLORS: { id: CanvasColor; css: string }[] = [
  { id: '1', css: '#e45757' },
  { id: '2', css: '#e67e22' },
  { id: '3', css: '#d4a017' },
  { id: '4', css: '#3d9a5b' },
  { id: '5', css: '#2a9d8f' },
  { id: '6', css: '#6c5ce7' },
]

export function canvasColorCss(color?: string) {
  if (!color) return undefined
  if (color.startsWith('#')) return color
  return CANVAS_COLORS.find((item) => item.id === color)?.css
}

export function isCanvasMemo(memo?: Pick<WorkspaceMemo, 'kind'> | null) {
  return memo?.kind === 'canvas'
}

export function isCanvasFileName(name?: string | null) {
  const n = (name || '').toLowerCase()
  return n.endsWith('.canvas') || n.endsWith('.arch.json')
}

function sideOf(id?: string, fallback: CanvasSide = 'right'): CanvasSide {
  if (id === 'top' || id === 'right' || id === 'bottom' || id === 'left') return id
  if (id === 't-top') return 'top'
  if (id === 't-right') return 'right'
  if (id === 't-bottom') return 'bottom'
  if (id === 't-left') return 'left'
  return fallback
}

function marker(end?: EdgeEnds) {
  return end === 'arrow' ? { type: MarkerType.ArrowClosed, width: 16, height: 16 } : undefined
}

export function normalizeCanvasText(text?: string | null) {
  return String(text || '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '')
}

function fileBasename(path?: string) {
  const name = String(path || '').replace(/\\/g, '/').split('/').pop() || ''
  return name
}

export function flowNodeFromJson(node: JsonCanvasNode): Node {
  const fileName = fileBasename(node.file) || node.label || ''
  const suffix = (node.suffix || (fileName.includes('.') ? fileName.split('.').pop() : '') || '').toLowerCase()
  return {
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    style: { width: node.width, height: node.height },
    zIndex: node.type === 'group' ? -1 : 1,
    data: {
      text: normalizeCanvasText(node.text),
      color: node.color,
      memoId: node.memoId || '',
      title: node.label || fileName,
      kind: node.kind || (node.type === 'file' && !node.memoId ? 'file' : 'md'),
      fileId: node.fileId || '',
      url: node.url || '',
      label: node.label || fileName,
      suffix,
      size: node.size || 0,
      mime: node.mime || '',
      isDir: Boolean(node.isDir),
    },
  }
}

export function jsonNodeFromFlow(node: Node): JsonCanvasNode {
  const width = Number(node.width ?? node.style?.width ?? 260)
  const height = Number(node.height ?? node.style?.height ?? 140)
  const type = (node.type || 'text') as JsonCanvasNode['type']
  return {
    id: node.id,
    type: type === 'text' || type === 'file' || type === 'link' || type === 'group' ? type : 'text',
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    color: typeof node.data?.color === 'string' ? node.data.color : undefined,
    text: typeof node.data?.text === 'string' ? node.data.text : undefined,
    memoId: typeof node.data?.memoId === 'string' ? node.data.memoId : undefined,
    kind: typeof node.data?.kind === 'string' ? node.data.kind : undefined,
    fileId: typeof node.data?.fileId === 'string' ? node.data.fileId : undefined,
    suffix: typeof node.data?.suffix === 'string' ? node.data.suffix : undefined,
    size: typeof node.data?.size === 'number' ? node.data.size : undefined,
    mime: typeof node.data?.mime === 'string' ? node.data.mime : undefined,
    isDir: node.data?.isDir === true ? true : undefined,
    url: typeof node.data?.url === 'string' ? node.data.url : undefined,
    label:
      typeof node.data?.label === 'string'
        ? node.data.label
        : typeof node.data?.title === 'string'
          ? node.data.title
          : undefined,
    file: typeof node.data?.title === 'string' ? node.data.title : undefined,
  }
}

export function flowEdgeFromJson(edge: JsonCanvasEdge): Edge {
  const fromEnd = edge.fromEnd ?? 'none'
  const toEnd = edge.toEnd ?? 'arrow'
  return {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide,
    targetHandle: `t-${edge.toSide || 'left'}`,
    label: edge.label || '',
    type: 'canvas',
    markerStart: marker(toEnd),
    markerEnd: marker(fromEnd),
    style: edge.color ? { stroke: canvasColorCss(edge.color) } : undefined,
    data: { color: edge.color, fromEnd, toEnd, label: edge.label || '' },
  }
}

export function jsonEdgeFromFlow(edge: Edge): JsonCanvasEdge {
  const fromEnd = (edge.data?.fromEnd as EdgeEnds) || 'none'
  const toEnd = (edge.data?.toEnd as EdgeEnds) || (edge.markerEnd ? 'arrow' : 'none')
  return {
    id: edge.id,
    fromNode: edge.source,
    toNode: edge.target,
    fromSide: sideOf(edge.sourceHandle, 'right'),
    toSide: sideOf(edge.targetHandle, 'left'),
    label: (edge.label as string) || (edge.data?.label as string) || undefined,
    color: typeof edge.data?.color === 'string' ? edge.data.color : undefined,
    fromEnd,
    toEnd,
  }
}

function migrateLegacy(raw: Record<string, unknown>): MemoCanvasDocument {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const edges = Array.isArray(raw.edges) ? raw.edges : []
  const migratedNodes: JsonCanvasNode[] = nodes.map((item) => {
    const node = item as Node & JsonCanvasNode
    if (node.x != null && node.type && ['text', 'file', 'link', 'group'].includes(String(node.type))) {
      return node as JsonCanvasNode
    }
    const label = String(node.data?.label || node.data?.title || '')
    const memoId = String(node.data?.memoId || '')
    if (node.type === 'memoEmbed' || memoId) {
      return {
        id: node.id,
        type: 'file',
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: Number(node.style?.width ?? 360),
        height: Number(node.style?.height ?? 280),
        memoId,
        kind: String(node.data?.kind || 'md'),
        label,
        file: label,
      }
    }
    return {
      id: node.id,
      type: 'text',
      x: node.position?.x ?? 0,
      y: node.position?.y ?? 0,
      width: Number(node.style?.width ?? 220),
      height: Number(node.style?.height ?? 80),
      text: label,
    }
  })
  const migratedEdges: JsonCanvasEdge[] = edges.map((item) => {
    const edge = item as Edge & JsonCanvasEdge
    if (edge.fromNode) return edge as JsonCanvasEdge
    return {
      id: edge.id,
      fromNode: edge.source,
      toNode: edge.target,
      fromSide: sideOf(edge.sourceHandle),
      toSide: sideOf(edge.targetHandle),
      toEnd: 'arrow',
    }
  })
  return {
    nodes: migratedNodes,
    edges: migratedEdges,
    viewport: raw.viewport as MemoCanvasDocument['viewport'],
  }
}

export function parseCanvasDocument(raw?: string | null): MemoCanvasDocument {
  if (!raw?.trim()) return { ...EMPTY_CANVAS, nodes: [], edges: [] }
  try {
    return migrateLegacy(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return { ...EMPTY_CANVAS, nodes: [], edges: [] }
  }
}

export function stringifyCanvasDocument(doc: MemoCanvasDocument) {
  return JSON.stringify({
    nodes: doc.nodes,
    edges: doc.edges,
    viewport: doc.viewport ?? { x: 0, y: 0, zoom: 1 },
  })
}

export function toFlowGraph(doc: MemoCanvasDocument) {
  return {
    nodes: doc.nodes.map(flowNodeFromJson),
    edges: doc.edges.map(flowEdgeFromJson),
    viewport: doc.viewport,
  }
}

export function fromFlowGraph(nodes: Node[], edges: Edge[], viewport?: MemoCanvasDocument['viewport']) {
  return stringifyCanvasDocument({
    nodes: nodes.map(jsonNodeFromFlow),
    edges: edges.map(jsonEdgeFromFlow),
    viewport,
  })
}

export function newTextNode(position: { x: number; y: number }, text = ''): Node {
  return flowNodeFromJson({
    id: `text-${crypto.randomUUID()}`,
    type: 'text',
    x: position.x,
    y: position.y,
    width: 260,
    height: 140,
    text,
  })
}

export function newGroupNode(position: { x: number; y: number }, size?: { width: number; height: number }): Node {
  return flowNodeFromJson({
    id: `group-${crypto.randomUUID()}`,
    type: 'group',
    x: position.x,
    y: position.y,
    width: size?.width ?? 420,
    height: size?.height ?? 280,
    label: 'Group',
  })
}

export function newLinkNode(position: { x: number; y: number }, url: string): Node {
  return flowNodeFromJson({
    id: `link-${crypto.randomUUID()}`,
    type: 'link',
    x: position.x,
    y: position.y,
    width: 360,
    height: 280,
    url,
    label: url,
  })
}

export function newFileNode(
  memo: Pick<WorkspaceMemo, 'id' | 'title' | 'kind'> & { fileId?: string },
  position: { x: number; y: number }
): Node {
  return flowNodeFromJson({
    id: `file-${crypto.randomUUID()}`,
    type: 'file',
    x: position.x,
    y: position.y,
    width: 360,
    height: 280,
    memoId: memo.id,
    kind: memo.kind || 'md',
    label: memo.title || '',
    file: memo.title || '',
    fileId: memo.fileId,
  })
}

export function newWorkspaceFileNode(
  file: {
    id: string
    displayName: string
    suffix?: string
    size?: number
    mime?: string
    isDir?: boolean
  },
  position: { x: number; y: number }
): Node {
  const suffix = (file.suffix || '').toLowerCase()
  const image = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(suffix)
  return flowNodeFromJson({
    id: `file-${crypto.randomUUID()}`,
    type: 'file',
    x: position.x,
    y: position.y,
    width: image ? 360 : 280,
    height: image ? 260 : 96,
    fileId: file.id,
    kind: image ? 'image' : 'file',
    label: file.displayName,
    file: file.displayName,
    suffix,
    size: file.size,
    mime: file.mime,
    isDir: file.isDir,
  })
}

export function newImageNode(
  file: { id: string; displayName: string; suffix?: string; size?: number; mime?: string },
  position: { x: number; y: number }
): Node {
  return newWorkspaceFileNode(file, position)
}

export function positionFromSide(side: CanvasSide) {
  if (side === 'top') return Position.Top
  if (side === 'bottom') return Position.Bottom
  if (side === 'left') return Position.Left
  return Position.Right
}

export function prepareCanvasDocument(raw: string, options?: { dropLinks?: boolean }) {
  const doc = parseCanvasDocument(raw)
  const nodes = doc.nodes.filter((node) => {
    if (node.memoId || node.fileId) return false
    if (options?.dropLinks && node.type === 'link') return false
    return true
  })
  const keep = new Set(nodes.map((node) => node.id))
  return stringifyCanvasDocument({
    ...doc,
    nodes,
    edges: doc.edges.filter((edge) => keep.has(edge.fromNode) && keep.has(edge.toNode)),
  })
}

export function stripEmbedsFromDocument(raw: string) {
  return prepareCanvasDocument(raw)
}
