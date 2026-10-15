/** 八人同房：低饱和色，避免画布太花 */
const PALETTE = [
  '#4F7FD4',
  '#3B8F68',
  '#B56A2A',
  '#B45068',
  '#6A5CAE',
  '#3A8A96',
  '#7A6E45',
  '#5E6E84',
] as const

export type PresencePoint = { x: number; y: number }

export type PresenceCursor = {
  x: number
  y: number
  type: string
  rotation: number
}

export type PresenceBrush = { x: number; y: number; w: number; h: number }

export type PresencePayload = {
  type: 'PRESENCE'
  from: string
  name: string
  color: string
  pageId: string
  cursor: PresenceCursor | null
  selectedShapeIds: string[]
  brush: PresenceBrush | null
  trail: PresencePoint[]
}

export type PresenceLeavePayload = {
  type: 'PRESENCE_LEAVE'
  from: string
}

export type PeerTrail = {
  peerId: string
  color: string
  points: PresencePoint[]
}

const TRAIL_MAX = 12
const TRAIL_MIN_DIST = 3

export function colorFromPeerId(peerId: string): string {
  let hash = 0
  for (let i = 0; i < peerId.length; i++) {
    hash = (hash * 31 + peerId.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function shortPresenceName(peerId: string): string {
  const raw = peerId.replace(/^u-/, '').slice(-4).toUpperCase()
  return raw || 'ME'
}

export function pushTrailPoint(trail: PresencePoint[], point: PresencePoint): PresencePoint[] {
  const last = trail[trail.length - 1]
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < TRAIL_MIN_DIST) {
    return trail
  }
  const next = trail.length >= TRAIL_MAX ? trail.slice(trail.length - TRAIL_MAX + 1) : trail.slice()
  next.push(point)
  return next
}

export function sanitizeTrail(raw: unknown): PresencePoint[] {
  if (!Array.isArray(raw)) return []
  const out: PresencePoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const x = Number((p as PresencePoint).x)
    const y = Number((p as PresencePoint).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({ x, y })
    if (out.length >= TRAIL_MAX) break
  }
  return out
}

export function sanitizeSelectedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 24)
}

export function sanitizeBrush(raw: unknown): PresenceBrush | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as PresenceBrush
  const x = Number(b.x)
  const y = Number(b.y)
  const w = Number(b.w)
  const h = Number(b.h)
  if (![x, y, w, h].every(Number.isFinite)) return null
  return { x, y, w, h }
}
