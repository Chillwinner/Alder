import {
  ArrowShapeKindStyle,
  createShapeId,
  toRichText,
  type Editor,
  type TLDefaultColorStyle,
  type TLGeoShapeGeoStyle,
  type TLShapeId,
} from 'tldraw'

export type ArchKind =
  | 'service'
  | 'db'
  | 'queue'
  | 'cache'
  | 'user'
  | 'gateway'
  | 'cloud'
  | 'store'

type ArchDef = {
  id: ArchKind
  geo: TLGeoShapeGeoStyle
  color: TLDefaultColorStyle
  w: number
  h: number
}

export const ARCH_ITEMS: ArchDef[] = [
  { id: 'service', geo: 'rectangle', color: 'blue', w: 168, h: 76 },
  { id: 'gateway', geo: 'hexagon', color: 'light-blue', w: 168, h: 80 },
  { id: 'db', geo: 'ellipse', color: 'violet', w: 150, h: 86 },
  { id: 'cache', geo: 'diamond', color: 'green', w: 120, h: 120 },
  { id: 'queue', geo: 'rectangle', color: 'orange', w: 188, h: 56 },
  { id: 'store', geo: 'rectangle', color: 'yellow', w: 150, h: 72 },
  { id: 'cloud', geo: 'cloud', color: 'grey', w: 168, h: 92 },
  { id: 'user', geo: 'ellipse', color: 'light-violet', w: 92, h: 92 },
]

function geoProps(def: ArchDef, label: string) {
  return {
    geo: def.geo,
    w: def.w,
    h: def.h,
    color: def.color,
    labelColor: 'black' as const,
    fill: 'semi' as const,
    dash: 'solid' as const,
    size: 'm' as const,
    font: 'sans' as const,
    align: 'middle' as const,
    verticalAlign: 'middle' as const,
    richText: toRichText(label),
    url: '',
    growY: 0,
    scale: 1,
  }
}

function viewCenter(editor: Editor, w: number, h: number, jitter = true) {
  const box = editor.getViewportPageBounds()
  const jx = jitter ? (Math.random() - 0.5) * 48 : 0
  const jy = jitter ? (Math.random() - 0.5) * 48 : 0
  return { x: box.midX - w / 2 + jx, y: box.midY - h / 2 + jy }
}

export function preferElbowArrows(editor: Editor) {
  editor.setStyleForNextShapes(ArrowShapeKindStyle, 'elbow')
}

export function useElbowArrowTool(editor: Editor) {
  preferElbowArrows(editor)
  for (const shape of editor.getSelectedShapes()) {
    if (shape.type !== 'arrow') continue
    if ((shape.props as { kind?: string }).kind === 'elbow') continue
    editor.updateShape({
      id: shape.id,
      type: 'arrow',
      props: { kind: 'elbow', elbowMidPoint: 0.5 },
    })
  }
  editor.setCurrentTool('arrow')
}

export function insertArchShape(editor: Editor, kind: ArchKind, label: string) {
  const def = ARCH_ITEMS.find((item) => item.id === kind)
  if (!def) return
  const pos = viewCenter(editor, def.w, def.h)
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'geo',
    x: pos.x,
    y: pos.y,
    props: geoProps(def, label),
  })
  editor.select(id)
}

function box(
  editor: Editor,
  kind: ArchKind,
  label: string,
  x: number,
  y: number,
): { id: TLShapeId; def: ArchDef } {
  const def = ARCH_ITEMS.find((item) => item.id === kind)!
  const id = createShapeId()
  editor.createShape({
    id,
    type: 'geo',
    x,
    y,
    props: geoProps(def, label),
  })
  return { id, def }
}

function connect(editor: Editor, from: TLShapeId, to: TLShapeId) {
  const arrowId = createShapeId()
  editor.createShape({
    id: arrowId,
    type: 'arrow',
    x: 0,
    y: 0,
    props: {
      kind: 'elbow',
      color: 'grey',
      labelColor: 'black',
      fill: 'none',
      dash: 'solid',
      size: 'm',
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      font: 'sans',
      start: { x: 0, y: 0 },
      end: { x: 80, y: 0 },
      bend: 0,
      text: '',
      labelPosition: 0.5,
      scale: 1,
      elbowMidPoint: 0.5,
    },
  })
  editor.createBinding({
    type: 'arrow',
    fromId: arrowId,
    toId: from,
    props: {
      terminal: 'start',
      normalizedAnchor: { x: 1, y: 0.5 },
      isExact: false,
      isPrecise: true,
      snap: 'center',
    },
  })
  editor.createBinding({
    type: 'arrow',
    fromId: arrowId,
    toId: to,
    props: {
      terminal: 'end',
      normalizedAnchor: { x: 0, y: 0.5 },
      isExact: false,
      isPrecise: true,
      snap: 'center',
    },
  })
}

export function insertArchTemplate(
  editor: Editor,
  labels: Record<ArchKind, string>,
) {
  const origin = viewCenter(editor, 780, 220, false)
  const x0 = origin.x
  const y0 = origin.y
  const gap = 48

  const user = box(editor, 'user', labels.user, x0, y0 + 8)
  const gw = box(editor, 'gateway', labels.gateway, x0 + user.def.w + gap, y0 + 4)
  const svc = box(editor, 'service', labels.service, x0 + user.def.w + gw.def.w + gap * 2, y0 + 6)
  const db = box(editor, 'db', labels.db, x0 + user.def.w + gw.def.w + svc.def.w + gap * 3, y0)
  const cache = box(
    editor,
    'cache',
    labels.cache,
    svc.def.w + x0 + user.def.w + gw.def.w + gap * 2 + 24,
    y0 + 120,
  )
  connect(editor, user.id, gw.id)
  connect(editor, gw.id, svc.id)
  connect(editor, svc.id, db.id)
  connect(editor, svc.id, cache.id)
  editor.select(user.id, gw.id, svc.id, db.id, cache.id)
}
